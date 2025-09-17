const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

class TdaUiManager {
    async _createDraftPageImage(draftPage) {
        if (!draftPage || draftPage.length === 0) return null;

        const cardWidth = 250;
        const cardHeight = 350;
        const canvasWidth = cardWidth * draftPage.length;
        const canvasHeight = cardHeight;

        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        for (let i = 0; i < draftPage.length; i++) {
            const card = draftPage[i];
            try {
                const imagePath = path.join(__dirname, '..', '..', '..', 'resources', 'threedragonanteimages', card.image);
                const image = await loadImage(imagePath);
                ctx.drawImage(image, i * cardWidth, 0, cardWidth, cardHeight);
            } catch (error) {
                console.error(`TDA UI Error: Could not load image for ${card.name}: ${error.message}`);
                // Draw a placeholder if image fails to load
                ctx.fillStyle = '#2C2F33'; // Discord grey
                ctx.fillRect(i * cardWidth, 0, cardWidth, cardHeight);
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '20px Sans';
                ctx.textAlign = 'center';
                ctx.fillText(card.name, i * cardWidth + cardWidth / 2, canvasHeight / 2);
                ctx.fillText('(Image not found)', i * cardWidth + cardWidth / 2, canvasHeight / 2 + 25);
            }
        }

        return canvas.toBuffer('image/png');
    }
    constructor(client) {
        this.client = client;
        this.manager = null; // Will be set by CommandHandler
    }

    setGameManager(gameManager) {
        this.manager = gameManager;
    }

    async _getDmChannel(playerId) {
        try {
            const user = await this.client.users.fetch(playerId);
            return await user.createDM();
        } catch (error) {
            console.error(`Could not get/create DM channel for user ${playerId}:`, error);
            return null;
        }
    }

    // --- Embed Generation ---

    _createLogEmbed(game) {
        const embed = new EmbedBuilder()
            .setTitle('Game Log')
            .setColor(0xaaaaaa)
            .setDescription(game.gambit.log.slice(-10).join('\n') || 'Log is empty.');

        if (game.turnExpiresAt) {
            const secondsRemaining = Math.round((game.turnExpiresAt - Date.now()) / 1000);
            let currentPlayer;
            if (game.state === 'drafting') {
                currentPlayer = game.players.find(p => p.id === game.draft.turnOrder[game.draft.currentPlayerIndex]);
            } else if (game.gambit?.turnOrder) {
                currentPlayer = game.gambit.turnOrder[game.gambit.currentPlayerIndex];
            }

            if (currentPlayer) {
                embed.setFooter({ text: `Your turn, ${currentPlayer.user.username}! Time remaining: ${secondsRemaining}s` });
            }
        }
        return embed;
    }

    _createOpponentEmbed(game, opponent) {
        const flight = opponent.flight || [];
        const hand = opponent.hand || [];
        const flightValue = flight.reduce((sum, card) => sum + card.value, 0);
        const handEmoji = '🃏'.repeat(hand.length) + '⬛'.repeat(10 - hand.length);

        const embed = new EmbedBuilder()
            .setTitle(opponent.user.username)
            .setColor(0x5865F2)
            .addFields(
                { name: 'Hoard', value: `${opponent.hoard}gp`, inline: true },
                { name: 'Hand', value: `${handEmoji} (${hand.length})`, inline: true },
                { name: 'Flight Value', value: flightValue.toString(), inline: true }
            );

        if (flight.length > 0) {
            embed.addFields({ name: 'Flight', value: flight.map(c => c.name).join(', ') });
        } else {
            embed.addFields({ name: 'Flight', value: '(empty)' });
        }

        return embed;
    }

    _createAnteEmbed(game) {
        const embed = new EmbedBuilder()
            .setTitle('Ante Area')
            .setColor(0xfee75c);

        let description = '';
        const allAnted = game.players.every(p => p.anteCard);

        if (game.state === 'ante' || game.state === 'playing_round') {
             game.players.forEach(p => {
                if (p.anteCard) {
                    const cardName = allAnted ? p.anteCard.name : '[Card Back]';
                    description += `${p.user.username}: ${cardName}\n`;
                } else {
                    description += `${p.user.username}: (Waiting to ante...)\n`;
                }
            });
        } else if (game.gambit?.antePile?.length > 0) {
            description = game.gambit.antePile.map(c => c.name).join('\n');
        } else {
            description = 'Anteing has not begun.';
        }
        embed.setDescription(description || 'Ante area is empty.');
        return embed;
    }

    _createPlayerFlightEmbed(game, player) {
        const flight = player.flight || [];
        const flightValue = flight.reduce((sum, card) => sum + card.value, 0);
        const embed = new EmbedBuilder()
            .setTitle(`Your Flight (Value: ${flightValue})`)
            .setColor(0x57F287);

        if (flight.length > 0) {
            embed.setDescription(flight.map(c => `**${c.name}** (Str ${c.value})`).join('\n'));
        } else {
            embed.setDescription('(Your flight is currently empty)');
        }
        return embed;
    }

    _createPlayerActionEmbed(game, player) {
        const embed = new EmbedBuilder()
            .setColor(0xED4245);

        if (game.state === 'drafting') {
            embed.setTitle('Card Draft');
            const currentPlayer = game.players.find(p => p.id === game.draft.turnOrder[game.draft.currentPlayerIndex]);
            let description = `Players are taking turns removing optional cards from the deck.\nCards removed so far: ${game.draft.removedCount} / 10.\n\n`;
            if (currentPlayer) {
                description += `It is currently **${currentPlayer.user.username}'s** turn to choose a card to remove.`;
            }
            embed.setDescription(description);
        } else {
            embed.setTitle(`Your Hand | Hoard: ${player.hoard}gp`);
            const hand = player.hand || [];
            if (hand.length > 0) {
                // The hand is already sorted by the game manager.
                embed.setDescription(hand.map(c => {
                    const alignment = this.manager._getCardAlignment(c);
                    const emoji = alignment === 'good' ? '😇' : alignment === 'evil' ? '😈' : '🧙';
                    return `• ${emoji} ${c.name} (Str ${c.value})`;
                }).join('\n'));
            } else {
                embed.setDescription('Your hand is empty.');
            }
        }

        return embed;
    }


    // --- UI Management ---

    async createGameBoard(game) {
        for (const player of game.players) {
            const dmChannel = await player.user.createDM();
            player.dmChannel = dmChannel;
            player.board = {};

            const logEmbed = this._createLogEmbed(game);
            const opponentEmbeds = game.players.filter(p => p.id !== player.id).map(opp => this._createOpponentEmbed(game, opp));
            const anteEmbed = this._createAnteEmbed(game);
            const playerFlightEmbed = this._createPlayerFlightEmbed(game, player);
            const playerActionEmbed = this._createPlayerActionEmbed(game, player);
            const components = this.getComponentsForState(game, player);
            let files = [];

            const isMyTurnInDraft = game.state === 'drafting' && game.draft.turnOrder[game.draft.currentPlayerIndex] === player.id;
            if (isMyTurnInDraft) {
                const page = player.draftPage || 0;
                const cardsPerPage = 5;
                const startIndex = page * cardsPerPage;
                const draftPage = game.draft.options.slice(startIndex, startIndex + cardsPerPage);

                if (draftPage.length > 0) {
                    const imageBuffer = await this._createDraftPageImage(draftPage);
                    if (imageBuffer) {
                        files.push({ attachment: imageBuffer, name: 'draft_page.png' });
                        playerActionEmbed.setImage('attachment://draft_page.png');
                    }
                }
            }


            try {
                player.board.logMessage = await dmChannel.send({ embeds: [logEmbed] });
                player.board.opponentMessages = await Promise.all(opponentEmbeds.map(e => dmChannel.send({ embeds: [e] })));
                player.board.anteMessage = await dmChannel.send({ embeds: [anteEmbed] });
                player.board.playerFlightMessage = await dmChannel.send({ embeds: [playerFlightEmbed] });
                player.board.playerActionMessage = await dmChannel.send({ embeds: [playerActionEmbed], components, files });
            } catch (error) {
                console.error(`Could not send game board to ${player.user.username}`, error);
            }
        }
    }

    async renderBoard(game) {
        for (const player of game.players) {
            await this.renderPlayer(game, player);
        }
    }

    async renderPlayer(game, player) {
        if (!player.dmChannel || !player.board) return;
        try {
            const logEmbed = this._createLogEmbed(game);
            await player.board.logMessage.edit({ embeds: [logEmbed] });

            const opponents = game.players.filter(p => p.id !== player.id);
            for (let i = 0; i < opponents.length; i++) {
                const opponentEmbed = this._createOpponentEmbed(game, opponents[i]);
                if (player.board.opponentMessages[i]) {
                    await player.board.opponentMessages[i].edit({ embeds: [opponentEmbed] });
                }
            }

            const anteEmbed = this._createAnteEmbed(game);
            await player.board.anteMessage.edit({ embeds: [anteEmbed] });

            const playerFlightEmbed = this._createPlayerFlightEmbed(game, player);
            await player.board.playerFlightMessage.edit({ embeds: [playerFlightEmbed] });

            const playerActionEmbed = this._createPlayerActionEmbed(game, player);
            const components = this.getComponentsForState(game, player);
            let files = [];

            const isMyTurnInDraft = game.state === 'drafting' && game.draft.turnOrder[game.draft.currentPlayerIndex] === player.id;
            if (isMyTurnInDraft) {
                const page = player.draftPage || 0;
                const cardsPerPage = 5;
                const startIndex = page * cardsPerPage;
                const draftPage = game.draft.options.slice(startIndex, startIndex + cardsPerPage);

                if (draftPage.length > 0) {
                    const imageBuffer = await this._createDraftPageImage(draftPage);
                    if (imageBuffer) {
                        files.push({ attachment: imageBuffer, name: 'draft_page.png' });
                        playerActionEmbed.setImage('attachment://draft_page.png');
                    }
                }
            }

            await player.board.playerActionMessage.edit({ embeds: [playerActionEmbed], components, files });
        } catch (error) {
            console.error(`Failed to render board for ${player.user.username}`, error);
        }
    }

    getComponentsForState(game, player) {
        const currentPlayer = game.gambit?.turnOrder ? game.gambit.turnOrder[game.gambit.currentPlayerIndex] : null;
        const isMyTurn = currentPlayer && currentPlayer.id === player.id;

        switch(game.state) {
            case 'drafting':
                return this.getDraftComponents(game, player);
            case 'ante':
                return this.getAnteComponents(game, player);
            case 'playing_round':
                return this.getPlayCardComponents(game, player, isMyTurn);
            case 'continue':
                return this.getContinueLeaveComponents(game, player);
            default:
                return [];
        }
    }

    getDraftComponents(game, player) {
        const isMyTurn = game.draft.turnOrder[game.draft.currentPlayerIndex] === player.id;
        if (!isMyTurn) return [];

        const page = player.draftPage || 0;
        const cardsPerPage = 5;
        const startIndex = page * cardsPerPage;
        const endIndex = startIndex + cardsPerPage;
        const draftPage = game.draft.options.slice(startIndex, endIndex);

        const components = [];
        const cardRow = new ActionRowBuilder();
        draftPage.forEach((card, index) => {
            const alignment = this.manager._getCardAlignment(card);
            const emoji = alignment === 'good' ? '😇' : alignment === 'evil' ? '😈' : '🧙';
            cardRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tda_draft_remove_${card.image}`)
                    .setLabel(`${card.name} (Str ${card.value})`)
                    .setEmoji(emoji)
                    .setStyle(ButtonStyle.Danger)
            );
        });
        if (cardRow.components.length > 0) components.push(cardRow);

        if (game.draft.options.length > cardsPerPage) {
            const navRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('tda_draft_page_prev')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('tda_draft_page_next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                );
            components.push(navRow);
        }

        return components;
    }

    getContinueLeaveComponents(game, player) {
        const status = player.continueStatus;
        if (status === 'ready' || status === 'left') return [];

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('tda_continue_same_deck')
                    .setLabel('Play Again (Same Deck)')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('tda_continue_new_deck')
                    .setLabel('Play Again (New Deck)')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('tda_continue_leave')
                    .setLabel('Leave Game')
                    .setStyle(ButtonStyle.Danger)
            );
        return [row];
    }

    getPlayCardComponents(game, player, isMyTurn) {
        if (!isMyTurn || !player.hand || player.hand.length === 0) return [];

        const page = player.handPage || 0;
        const cardsPerPage = 5;
        const startIndex = page * cardsPerPage;
        const endIndex = startIndex + cardsPerPage;
        const handPage = player.hand.slice(startIndex, endIndex);

        const components = [];
        const cardRow = new ActionRowBuilder();
        handPage.forEach((card, index) => {
            const cardIndex = startIndex + index;
            const alignment = this.manager._getCardAlignment(card);
            const emoji = alignment === 'good' ? '😇' : alignment === 'evil' ? '😈' : '🧙';
            cardRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tda_play_${cardIndex}`)
                    .setLabel(`${card.name} (Str ${card.value})`)
                    .setEmoji(emoji)
                    .setStyle(ButtonStyle.Primary)
            );
        });
        components.push(cardRow);

        if (player.hand.length > cardsPerPage) {
            const navRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('tda_play_page_prev')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('tda_play_page_next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                );
            components.push(navRow);
        }

        return components;
    }

    getAnteComponents(game, player) {
        if (player.anteCard || !player.hand || player.hand.length === 0) return [];

        const page = player.handPage || 0;
        const cardsPerPage = 5;
        const startIndex = page * cardsPerPage;
        const endIndex = startIndex + cardsPerPage;
        const handPage = player.hand.slice(startIndex, endIndex);

        const components = [];
        const cardRow = new ActionRowBuilder();
        handPage.forEach((card, index) => {
            const cardIndex = startIndex + index;
            const alignment = this.manager._getCardAlignment(card);
            const emoji = alignment === 'good' ? '😇' : alignment === 'evil' ? '😈' : '🧙';
            cardRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tda_ante_${cardIndex}`)
                    .setLabel(`${card.name} (Str ${card.value})`)
                    .setEmoji(emoji)
                    .setStyle(ButtonStyle.Primary)
            );
        });
        components.push(cardRow);

        if (player.hand.length > cardsPerPage) {
            const navRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('tda_ante_page_prev')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('tda_ante_page_next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                );
            components.push(navRow);
        }

        return components;
    }

    async promptBlueDragonChoice(game, player) {
        this.manager._startTurnTimer(game, player);
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('tda_blue_choice_take')
                    .setLabel('Take 1 Gold from each Opponent')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('tda_blue_choice_stakes')
                    .setLabel('Opponents add Gold to Stakes')
                    .setStyle(ButtonStyle.Secondary)
            );

        await player.board.playerActionMessage.edit({
            content: "You played a Blue Dragon! Choose its power:",
            embeds: [this._createPlayerActionEmbed(game, player)],
            components: [row]
        });
    }

    async promptGreenDragonChoice(game, originalPlayer, nextPlayer, availableCards) {
        this.manager._startTurnTimer(game, nextPlayer);
        const components = [];
        const goldAmount = 5 * game.scalingFactor;

        const payButton = new ButtonBuilder()
            .setCustomId(`tda_green_choice_pay_${originalPlayer.id}`)
            .setLabel(`Pay ${goldAmount} Gold`)
            .setStyle(ButtonStyle.Danger);

        if (nextPlayer.hoard < goldAmount) {
            payButton.setDisabled(true);
        }
        components.push(new ActionRowBuilder().addComponents(payButton));

        if (availableCards.length > 0) {
            const options = availableCards.map((card, index) => {
                const originalIndex = nextPlayer.hand.findIndex(c => c === card);
                return {
                    label: `${card.name} (Str ${card.value})`,
                    value: originalIndex.toString()
                };
            });
            const giveMenu = new StringSelectMenuBuilder()
                .setCustomId(`tda_green_choice_give_${originalPlayer.id}`)
                .setPlaceholder('Give a weaker evil dragon')
                .addOptions(options);
            components.push(new ActionRowBuilder().addComponents(giveMenu));
        }

        await nextPlayer.board.playerActionMessage.edit({
            content: `${originalPlayer.user.username} played a Green Dragon! You are the next player. You must choose to pay them, or give them a weaker evil dragon from your hand.`,
            embeds: [this._createPlayerActionEmbed(game, nextPlayer)],
            components: components
        });
    }

    async promptBrassDragonChoice(game, originalPlayer, lastPlayer, availableCards) {
        this.manager._startTurnTimer(game, lastPlayer);
        const components = [];
        const goldAmount = 5 * game.scalingFactor;

        const payButton = new ButtonBuilder()
            .setCustomId(`tda_brass_choice_pay_${originalPlayer.id}`)
            .setLabel(`Pay ${goldAmount} Gold`)
            .setStyle(ButtonStyle.Danger);

        if (lastPlayer.hoard < goldAmount) {
            payButton.setDisabled(true);
        }
        components.push(new ActionRowBuilder().addComponents(payButton));

        if (availableCards.length > 0) {
            const options = availableCards.map((card, index) => {
                const originalIndex = lastPlayer.hand.findIndex(c => c === card);
                return {
                    label: `${card.name} (Str ${card.value})`,
                    value: originalIndex.toString()
                };
            });
            const giveMenu = new StringSelectMenuBuilder()
                .setCustomId(`tda_brass_choice_give_${originalPlayer.id}`)
                .setPlaceholder('Give a stronger good dragon')
                .addOptions(options);
            components.push(new ActionRowBuilder().addComponents(giveMenu));
        }

        await lastPlayer.board.playerActionMessage.edit({
            content: `${originalPlayer.user.username} played a Brass Dragon! As the player who played last, you must choose to pay them, or give them a stronger good dragon from your hand.`,
            embeds: [this._createPlayerActionEmbed(game, lastPlayer)],
            components: components
        });
    }
    async promptKoboldChoice(game, player) {
        this.manager._startTurnTimer(game, player);
        const dmChannel = await this._getDmChannel(player.id);
        if (!dmChannel) return;

        const embed = new EmbedBuilder()
            .setColor(0xC27C0E)
            .setTitle('Kobold\'s Power')
            .setDescription('Choose cards from your hand to discard. You will draw that many new cards.\nYour choice is final and will be processed immediately.')
            .setThumbnail(`attachment://kobold.jpg`);

        if (player.hand.length === 0) {
            return; // Should be handled by game logic, but prevents error.
        }

        const options = player.hand.map((card, index) => ({
            label: `${card.name} (Str ${card.value})`.substring(0, 100),
            value: `${index}`
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`tda_kobold_choice_${game.channelId}_${player.id}`)
            .setPlaceholder('Select cards to discard')
            .setMinValues(0)
            .setMaxValues(player.hand.length)
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const imagePath = path.join(__dirname, '..', '..', '..', 'resources', 'threedragonanteimages', 'kobold.jpg');

        try {
            await dmChannel.send({
                embeds: [embed],
                components: [row],
                files: [{ attachment: imagePath, name: 'kobold.jpg' }]
            });
        } catch (e) {
            console.error("TDA UI Error: Could not send Kobold prompt.", e);
        }
    }

    async promptSorcererChoice(game, player, revealedCardData) {
        this.manager._startTurnTimer(game, player);
        const dmChannel = await this._getDmChannel(player.id);
        if (!dmChannel) return;

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('Sorcerer\'s Power')
            .setDescription('Choose one card to replace your Sorcerer. The other two go to the ante pile.')
            .setThumbnail(`attachment://Sorcerer.jpg`);

        const cardFields = revealedCardData.map(card => ({
            name: card.name,
            value: `Strength: ${card.value}\nPower: ${card.text}`.substring(0, 1024),
            inline: true
        }));
        embed.addFields(cardFields);

        const row = new ActionRowBuilder();
        revealedCardData.forEach(card => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tda_sorcerer_choice_${game.channelId}_${player.id}_${card.image}`)
                    .setLabel(card.name.substring(0, 80))
                    .setStyle(ButtonStyle.Secondary)
            );
        });

        const imagePath = path.join(__dirname, '..', '..', '..', 'resources', 'threedragonanteimages', 'Sorcerer.jpg');

        try {
            await dmChannel.send({
                embeds: [embed],
                components: [row],
                files: [{ attachment: imagePath, name: 'Sorcerer.jpg' }]
            });
        } catch (e) {
            console.error("TDA UI Error: Could not send Sorcerer prompt.", e);
        }
    }

    async promptTargetPlayer(game, player, targets, reason) {
        this.manager._startTurnTimer(game, player);
        const dmChannel = await this._getDmChannel(player.id);
        if (!dmChannel) return;

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('Choose a Target')
            .setDescription(reason);

        const options = targets.map(target => ({
            label: target.user.username,
            description: `Flight Strength: ${target.flight.reduce((sum, c) => sum + c.value, 0)}`,
            value: target.id
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`tda_target_player_${game.channelId}_${player.id}`)
            .setPlaceholder('Select a player to target')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        try {
            await player.board.playerActionMessage.edit({
                embeds: [embed, this._createPlayerActionEmbed(game, player)],
                components: [row]
            });
        } catch (e) {
            console.error(`TDA UI Error: Could not send target prompt to ${player.user.username}`, e);
        }
    }

    async closeGameBoard(player, reason) {
        if (!player.dmChannel || !player.board) return;

        const gameOverEmbed = new EmbedBuilder()
            .setColor(0x992D22)
            .setTitle('Game Over')
            .setDescription(reason);

        const editPromises = [];

        // Edit all messages to show the game over state and remove components
        if (player.board.logMessage) {
            editPromises.push(player.board.logMessage.edit({ embeds: [gameOverEmbed], components: [] }).catch(e => console.error(`Failed to edit logMessage for ${player.user.username}`, e)));
        }
        if (player.board.opponentMessages) {
            player.board.opponentMessages.forEach(msg => {
                editPromises.push(msg.edit({ embeds: [gameOverEmbed], components: [] }).catch(e => console.error(`Failed to edit opponentMessage for ${player.user.username}`, e)));
            });
        }
        if (player.board.anteMessage) {
            editPromises.push(player.board.anteMessage.edit({ embeds: [gameOverEmbed], components: [] }).catch(e => console.error(`Failed to edit anteMessage for ${player.user.username}`, e)));
        }
        if (player.board.playerFlightMessage) {
            editPromises.push(player.board.playerFlightMessage.edit({ embeds: [gameOverEmbed], components: [] }).catch(e => console.error(`Failed to edit playerFlightMessage for ${player.user.username}`, e)));
        }
        if (player.board.playerActionMessage) {
            editPromises.push(player.board.playerActionMessage.edit({ embeds: [gameOverEmbed], components: [] }).catch(e => console.error(`Failed to edit playerActionMessage for ${player.user.username}`, e)));
        }

        try {
            await Promise.all(editPromises);
        } catch (error) {
            // The individual catches will log errors, this is an additional safeguard.
            console.error(`An error occurred while closing game board for ${player.user.username}`, error);
        }
    }
}

module.exports = TdaUiManager;
