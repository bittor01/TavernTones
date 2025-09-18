const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

class TdaUiManager {
    async _createCardCollage(cards, maxCards = 10) {
        if (!cards || cards.length === 0) return null;

        const cardWidth = 250;
        const cardHeight = 350;
        const cardsToDraw = cards.slice(0, maxCards);
        const canvasWidth = cardWidth * cardsToDraw.length;
        const canvasHeight = cardHeight;

        if (canvasWidth === 0) return null;

        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        for (let i = 0; i < cardsToDraw.length; i++) {
            const card = cardsToDraw[i];
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
            .setColor(0xaaaaaa);

        const log = game.gambit?.log || [];
        embed.setDescription(log.slice(-15).join('\n') || 'Log is empty.');

        if (game.turnExpiresAt) {
            const secondsRemaining = Math.round((game.turnExpiresAt - Date.now()) / 1000);
            let currentPlayer;

            if (game.state === 'drafting' && game.draft?.turnOrder) {
                currentPlayer = game.players.find(p => p.id === game.draft.turnOrder[game.draft.currentPlayerIndex]);
            } else if (game.state === 'playing_round' && game.gambit?.turnOrder) {
                currentPlayer = game.gambit.turnOrder[game.gambit.currentPlayerIndex];
            }

            if (currentPlayer) {
                embed.setFooter({ text: `It's ${currentPlayer.user.username}'s turn! Time remaining: ${Math.max(0, secondsRemaining)}s` });
            }
        }
        return embed;
    }

    _createOpponentEmbed(game, opponent) {
        const flight = opponent?.flight || [];
        const hand = opponent?.hand || [];
        const hoard = opponent?.hoard ?? 0; // Use nullish coalescing for 0 values

        const flightValue = flight.reduce((sum, card) => sum + card.value, 0);
        const handEmoji = '🃏'.repeat(hand.length) + '⬛'.repeat(10 - hand.length);

        const embed = new EmbedBuilder()
            .setTitle(opponent.user.username)
            .setColor(0x5865F2)
            .addFields(
                { name: 'Hoard', value: `${hoard}gp`, inline: true },
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
            if (!dmChannel) continue;
            player.dmChannel = dmChannel;
            player.board = {};

            // Create embeds
            const logEmbed = this._createLogEmbed(game);
            const opponentEmbeds = game.players.filter(p => p.id !== player.id).map(opp => this._createOpponentEmbed(game, opp));
            const anteEmbed = this._createAnteEmbed(game);
            const playerFlightEmbed = this._createPlayerFlightEmbed(game, player);
            const playerActionEmbed = this._createPlayerActionEmbed(game, player);
            const components = this.getComponentsForState(game, player);

            // Generate images
            const flightImageBuffer = await this._createCardCollage(player.flight, 10);
            if (flightImageBuffer) {
                playerFlightEmbed.setImage('attachment://flight.png');
            }

            let actionImageBuffer = null;
            if (game.state === 'drafting') {
                const page = player.draftPage || 0;
                const draftPage = game.draft.options.slice(page * 5, page * 5 + 5);
                actionImageBuffer = await this._createCardCollage(draftPage, 5);
            } else {
                const page = player.handPage || 0;
                const handPage = (player.hand || []).slice(page * 5, page * 5 + 5);
                actionImageBuffer = await this._createCardCollage(handPage, 5);
            }
            if (actionImageBuffer) {
                playerActionEmbed.setImage('attachment://action_image.png');
            }

            try {
                player.board.logMessage = await dmChannel.send({ embeds: [logEmbed] });
                player.board.opponentMessages = await Promise.all(opponentEmbeds.map(e => dmChannel.send({ embeds: [e] })));
                player.board.anteMessage = await dmChannel.send({ embeds: [anteEmbed] });
                player.board.playerFlightMessage = await dmChannel.send({ embeds: [playerFlightEmbed], files: flightImageBuffer ? [{ attachment: flightImageBuffer, name: 'flight.png' }] : [] });
                player.board.playerActionMessage = await dmChannel.send({ embeds: [playerActionEmbed], components, files: actionImageBuffer ? [{ attachment: actionImageBuffer, name: 'action_image.png' }] : [] });
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
            // Edit embeds
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

            // Prepare embeds and images for flight and action messages
            const playerFlightEmbed = this._createPlayerFlightEmbed(game, player);
            const playerActionEmbed = this._createPlayerActionEmbed(game, player);
            const components = this.getComponentsForState(game, player);

            // Generate flight image
            const flightImageBuffer = await this._createCardCollage(player.flight, 10);
            if (flightImageBuffer) {
                playerFlightEmbed.setImage('attachment://flight.png');
            }
            await player.board.playerFlightMessage.edit({ embeds: [playerFlightEmbed], files: flightImageBuffer ? [{ attachment: flightImageBuffer, name: 'flight.png' }] : [] });

            // Generate hand/draft image
            let actionImageBuffer = null;
            if (game.state === 'drafting') {
                 const isMyTurnInDraft = game.draft.turnOrder[game.draft.currentPlayerIndex] === player.id;
                 if (isMyTurnInDraft) {
                    const page = player.draftPage || 0;
                    const draftPage = game.draft.options.slice(page * 5, page * 5 + 5);
                    actionImageBuffer = await this._createCardCollage(draftPage, 5);
                 }
            } else {
                const page = player.handPage || 0;
                const handPage = (player.hand || []).slice(page * 5, page * 5 + 5);
                actionImageBuffer = await this._createCardCollage(handPage, 5);
            }

            if (actionImageBuffer) {
                playerActionEmbed.setImage('attachment://action_image.png');
            } else {
                // Clear the image if no buffer was generated (e.g. not your turn in draft)
                playerActionEmbed.setImage(null);
            }

            await player.board.playerActionMessage.edit({ embeds: [playerActionEmbed], components, files: actionImageBuffer ? [{ attachment: actionImageBuffer, name: 'action_image.png' }] : [] });
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

        const detailsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('tda_details_hand')
                .setLabel('View Card Details')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔎')
        );
        components.push(detailsRow);

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

        const detailsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('tda_details_hand')
                .setLabel('View Card Details')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔎')
        );
        components.push(detailsRow);

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

    // --- Lobby and Scoreboard Management ---

    async updateLobbyEmbed(game) {
        const lobbyMessage = await this.client.channels.cache.get(game.channelId).messages.fetch(game.lobbyMessageId).catch(() => null);
        if (!lobbyMessage) return;

        const embed = new EmbedBuilder()
            .setTitle('Three-Dragon Ante Lobby')
            .setColor(0x5539cc)
            .setDescription('Players are gathering to play Three-Dragon Ante. Click "Join" to enter the game!')
            .addFields({ name: 'Game Settings', value: `Buy-in: ${game.buyIn}gp | Ante scaling: x${game.scalingFactor}` });

        let playerList = game.players.map(p => {
            // SPECIAL_ABILITIES is on the manager, not the UI manager
            const ability = this.manager.SPECIAL_ABILITIES.find(a => a.value === p.specialAbility);
            return `- ${p.user.username}` + (ability ? ` (${ability.label})` : '');
        }).join('\n');

        if (!playerList) playerList = 'No players have joined yet.';
        embed.addFields({ name: `Players (${game.players.length})`, value: playerList });

        if (game.lobbyExpiresAt) {
            const timeRemaining = Math.round((game.lobbyExpiresAt - Date.now()) / 1000);
            if (timeRemaining > 0) {
                embed.setFooter({ text: `Lobby expires in ${Math.floor(timeRemaining / 60)}m ${timeRemaining % 60}s` });
            } else {
                embed.setFooter({ text: 'Lobby has expired.' });
            }
        }

        const components = this._buildLobbyComponents(game);
        await lobbyMessage.edit({ embeds: [embed], components });
    }

    _buildLobbyComponents(game) {
        const joinButton = new ButtonBuilder().setCustomId('tda_join').setLabel('Join Game').setStyle(ButtonStyle.Success);
        const leaveButton = new ButtonBuilder().setCustomId('tda_leave').setLabel('Leave Game').setStyle(ButtonStyle.Danger);
        const startButton = new ButtonBuilder().setCustomId('tda_start').setLabel('Start Game').setStyle(ButtonStyle.Primary);

        const abilityMenu = new StringSelectMenuBuilder()
            .setCustomId('tda_ability_select')
            .setPlaceholder('Choose a special ability (optional)')
            .addOptions(this.manager.SPECIAL_ABILITIES); // Assumes manager is set

        const row1 = new ActionRowBuilder().addComponents(joinButton, leaveButton, startButton);
        const row2 = new ActionRowBuilder().addComponents(abilityMenu);
        return [row1, row2];
    }

    async updateScoreboard(game) {
        const scoreboardMessage = await this.client.channels.cache.get(game.channelId).messages.fetch(game.lobbyMessageId).catch(() => null);
        if (!scoreboardMessage) return;

        const embed = new EmbedBuilder()
            .setTitle('Three-Dragon Ante Scoreboard')
            .setColor(0x1ABC9C) // A green-ish color for "in-progress"
            .setTimestamp();

        const sortedPlayers = [...game.players].sort((a, b) => b.hoard - a.hoard);

        let description = `**Stakes:** ${game.gambit.stakes}gp\n\n`;
        sortedPlayers.forEach(p => {
            const flightValue = p.flight ? p.flight.reduce((sum, card) => sum + card.value, 0) : 0;
            const isLeader = game.gambit.leader && game.gambit.leader.id === p.id;
            const isCurrentTurn = game.gambit.turnOrder && game.gambit.turnOrder[game.gambit.currentPlayerIndex]?.id === p.id;

            let playerLine = '';
            if (isCurrentTurn) playerLine += '▶️ ';
            if (isLeader) playerLine += '👑 ';
            playerLine += `**${p.user.username}**`;

            description += `${playerLine}\n`;
            description += `> **Hoard:** ${p.hoard}gp\n`;
            description += `> **Flight Value:** ${flightValue}\n`;
        });

        embed.setDescription(description || 'Scoreboard is empty.');

        // Remove components when turning it into a scoreboard for the first time
        const components = scoreboardMessage.components.length > 0 ? [] : undefined;

        const editOptions = { embeds: [embed] };
        if (components) {
            editOptions.components = components;
        }

        await scoreboardMessage.edit(editOptions);
    }
}

module.exports = TdaUiManager;
