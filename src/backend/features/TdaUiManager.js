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
                ctx.fillStyle = '#2C2F33';
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
        this.manager = null;
    }

    _formatCardText(text, scalingFactor) {
        if (!text || !scalingFactor || scalingFactor === 1) return text;
        return text.replace(/(\d+)\s*(gold|gp)/gi, (match, amount) => {
            const scaledAmount = Math.floor(parseInt(amount, 10) * scalingFactor);
            return `${scaledAmount} gold`;
        });
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

    _createLogEmbed(game) {
        const embed = new EmbedBuilder().setTitle('Game Log').setColor(0xaaaaaa);
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
        const hoard = opponent?.hoard ?? 0;
        const flightValue = flight.reduce((sum, card) => sum + card.value, 0);
        const handEmoji = '🃏'.repeat(hand.length) + '⬛'.repeat(10 - hand.length);

        const embed = new EmbedBuilder().setTitle(opponent.user.username).setColor(0x5865F2)
            .addFields(
                { name: 'Hoard', value: `${hoard}gp`, inline: true },
                { name: 'Hand', value: `${handEmoji} (${hand.length})`, inline: true },
                { name: 'Flight Value', value: flightValue.toString(), inline: true }
            );
        embed.addFields({ name: 'Flight', value: flight.length > 0 ? flight.map(c => c.name).join(', ') : '(empty)' });
        return embed;
    }

    _createAnteEmbed(game) {
        const embed = new EmbedBuilder().setTitle('Ante Area').setColor(0xfee75c);
        let description = '';
        const allAnted = game.players.every(p => p.anteCard);

        if (game.state === 'ante' || game.state === 'playing_round') {
             game.players.forEach(p => {
                description += p.anteCard ? `${p.user.username}: ${allAnted ? p.anteCard.name : '[Card Back]'}\n` : `${p.user.username}: (Waiting to ante...)\n`;
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
        const embed = new EmbedBuilder().setTitle(`Your Flight (Value: ${flightValue})`).setColor(0x57F287);
        if (flight.length > 0) {
            const description = flight.map(c => {
                const effect = this.manager.CARD_EFFECTS.find(e => e.name === c.effect);
                return `**${c.name}** (Str ${c.value})\n*${this._formatCardText(effect?.text, game.scalingFactor) || 'No special power.'}*`;
            }).join('\n\n');
            embed.setDescription(description);
        } else {
            embed.setDescription('(Your flight is currently empty)');
        }
        return embed;
    }

    _createPlayerActionEmbed(game, player) {
        const embed = new EmbedBuilder();
        if (game.state === 'drafting') {
            embed.setTitle('Card Draft Pool').setColor(0x9B59B6);
            const page = player.draftPage || 0;
            const draftPage = game.draft.options.slice(page * 5, page * 5 + 5);
            if (draftPage.length > 0) {
                const description = draftPage.map(c => {
                    const effect = this.manager.CARD_EFFECTS.find(e => e.name === c.effect);
                    return `**${c.name}** (Str ${c.value})\n*${this._formatCardText(effect?.text, game.scalingFactor) || 'No special power.'}*`;
                }).join('\n\n');
                embed.setDescription(description);
            } else {
                embed.setDescription('No cards in the draft pool.');
            }
        } else {
            embed.setTitle(`Your Hand | Hoard: ${player.hoard}gp`).setColor(0xED4245);
            const hand = player.hand || [];
            const page = player.handPage || 0;
            const handPage = hand.slice(page * 5, page * 5 + 5);
            if (handPage.length > 0) {
                const description = handPage.map(c => {
                    const effect = this.manager.CARD_EFFECTS.find(e => e.name === c.effect);
                    return `**${c.name}** (Str ${c.value})\n*${this._formatCardText(effect?.text, game.scalingFactor) || 'No special power.'}*`;
                }).join('\n\n');
                embed.setDescription(description);
            } else {
                embed.setDescription('Your hand is empty.');
            }
        }
        return embed;
    }

    _createCurrentActionEmbed(game, player) {
        if (!this.manager.isPlayerTurn(game, player)) return null;
        let description;
        let color = game.flashColor || '#15633D';

        switch(game.state) {
            case 'drafting': description = "Choose a card from the draft pool to remove."; break;
            case 'ante': description = "Choose a card from your hand to ante."; break;
            case 'playing_round': description = "Choose a card from your hand to play into your flight."; break;
            case 'continue': description = "The gambit has ended. Choose to continue or leave."; break;
            default: description = "It's your turn to act!";
        }
        if (game.pendingPlayerChoice) {
            description = game.pendingPlayerChoice.reason || "You need to make a choice for a card's power.";
            color = game.flashColor || '#E9D502';
        }
        if (game.turnExpiresAt && game.turnTimer > 0 && (game.turnExpiresAt - Date.now()) / (game.turnTimer * 1000) < 0.2) {
            color = '#ff0f0f'; // Override flash with urgent red
        }
        return new EmbedBuilder().setTitle('ACTION REQUIRED').setColor(color).setDescription(description);
    }

    async _createPlayerBoard(game, player) {
        player.dmChannel = await this._getDmChannel(player.id);
        if (!player.dmChannel) return;

        // Send a single welcome/setup message first
        const setupMsg = await player.dmChannel.send({ content: 'Setting up your game board...' });

        player.board = {
            logMessage: await player.dmChannel.send({ embeds: [this._createLogEmbed(game)] }),
            opponentMessages: await Promise.all(game.players.filter(p => p.id !== player.id).map(opp => player.dmChannel.send({ embeds: [this._createOpponentEmbed(game, opp)] }))),
            anteMessage: await player.dmChannel.send({ embeds: [this._createAnteEmbed(game)] }),
            playerFlightMessage: await player.dmChannel.send({ embeds: [this._createPlayerFlightEmbed(game, player)] }),
            playerHandMessage: await player.dmChannel.send({ content: "​" }),
            currentActionMessage: await player.dmChannel.send({ content: "​" }),
        };

        // Delete the setup message
        await setupMsg.delete().catch(e => console.error("Error deleting setup message:", e));
    }

    async renderBoard(game) {
        for (const player of game.players) {
            await this.renderPlayer(game, player);
        }
    }

    async renderPlayer(game, player) {
        if (!player.board) {
            await this._createPlayerBoard(game, player);
        }

        if (!player.dmChannel || !player.board) return;

        try {
            await player.board.logMessage.edit({ embeds: [this._createLogEmbed(game)] });
            const opponents = game.players.filter(p => p.id !== player.id);
            for (let i = 0; i < opponents.length; i++) {
                if (player.board.opponentMessages[i]) await player.board.opponentMessages[i].edit({ embeds: [this._createOpponentEmbed(game, opponents[i])] });
            }
            await player.board.anteMessage.edit({ embeds: [this._createAnteEmbed(game)] });

            const playerFlightEmbed = this._createPlayerFlightEmbed(game, player);
            const flightImageBuffer = await this._createCardCollage(player.flight, 10);
            if (flightImageBuffer) playerFlightEmbed.setImage('attachment://flight.png');
            await player.board.playerFlightMessage.edit({ embeds: [playerFlightEmbed], files: flightImageBuffer ? [{ attachment: flightImageBuffer, name: 'flight.png' }] : [] });

            const isMyTurn = this.manager.isPlayerTurn(game, player);
            const playerActionEmbed = this._createPlayerActionEmbed(game, player);
            const draftOptions = game.state === 'drafting' ? game.draft.options : [];
            const handOptions = game.state !== 'drafting' ? (player.hand || []) : [];
            const actionImageBuffer = await this._createCardCollage(
                game.state === 'drafting' ? draftOptions.slice((player.draftPage || 0) * 5, (player.draftPage || 0) * 5 + 5) : handOptions.slice((player.handPage || 0) * 5, (player.handPage || 0) * 5 + 5), 5
            );

            if (isMyTurn) {
                const actionRequiredEmbed = this._createCurrentActionEmbed(game, player);
                if (actionImageBuffer) actionRequiredEmbed.setImage('attachment://action_image.png');
                const allComponents = [...this.getActionComponents(game, player), ...this.getHandComponents(game, player)];
                await player.board.currentActionMessage.edit({ embeds: [actionRequiredEmbed], components: allComponents, files: actionImageBuffer ? [{ attachment: actionImageBuffer, name: 'action_image.png' }] : [] });
                await player.board.playerHandMessage.edit({ embeds: [playerActionEmbed], components: [], files: [] });
            } else {
                if (actionImageBuffer) playerActionEmbed.setImage('attachment://action_image.png');
                await player.board.playerHandMessage.edit({ embeds: [playerActionEmbed], components: this.getHandComponents(game, player), files: actionImageBuffer ? [{ attachment: actionImageBuffer, name: 'action_image.png' }] : [] });
                await player.board.currentActionMessage.edit({ content: "​", embeds: [], components: [], files: [] });
            }
        } catch (error) {
            console.error(`Failed to render board for ${player.user.username}`, error);
        }
    }

    getActionComponents(game, player) {
        switch(game.state) {
            case 'drafting': return this.getDraftComponents(game, player);
            case 'ante': return this.getAnteComponents(game, player);
            case 'playing_round': return this.getPlayCardComponents(game, player);
            case 'continue': return this.getContinueLeaveComponents(game, player);
            default: return [];
        }
    }

    getHandComponents(game, player) {
        const list = game.state === 'drafting' ? game.draft.options : player.hand;
        if (!list || list.length <= 5) return [];
        const context = game.state === 'drafting' ? 'draft' : 'hand';
        const pageRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tda_${context}_page_prev`).setLabel('◀️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`tda_details_${context}`).setLabel('Show Details').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`tda_${context}_page_next`).setLabel('▶️').setStyle(ButtonStyle.Secondary)
        );
        return [pageRow];
    }

    getDraftComponents(game, player) {
        const page = player.draftPage || 0;
        const draftPage = game.draft.options.slice(page * 5, page * 5 + 5);
        if (draftPage.length === 0) return [];
        const row = new ActionRowBuilder();
        draftPage.forEach(card => {
            row.addComponents(new ButtonBuilder().setCustomId(`tda_draft_remove_${card.image}`).setLabel(`Remove: ${card.name}`).setStyle(ButtonStyle.Danger));
        });
        return [row];
    }

    getAnteComponents(game, player) {
        const page = player.handPage || 0;
        const handPage = (player.hand || []).slice(page * 5, page * 5 + 5);
        if (handPage.length === 0) return [];
        const row = new ActionRowBuilder();
        handPage.forEach((card, index) => {
            const originalIndex = page * 5 + index;
            row.addComponents(new ButtonBuilder().setCustomId(`tda_ante_${originalIndex}`).setLabel(`Ante: ${card.name}`).setStyle(ButtonStyle.Primary));
        });
        return [row];
    }

    getPlayCardComponents(game, player) {
        const page = player.handPage || 0;
        const handPage = (player.hand || []).slice(page * 5, page * 5 + 5);
        if (handPage.length === 0) return [];
        const row = new ActionRowBuilder();
        handPage.forEach((card, index) => {
            const originalIndex = page * 5 + index;
            row.addComponents(new ButtonBuilder().setCustomId(`tda_play_${originalIndex}`).setLabel(`Play: ${card.name}`).setStyle(ButtonStyle.Success));
        });
        return [row];
    }

    getContinueLeaveComponents(game, player) {
        return [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tda_continue_same_deck').setLabel('Play Again (Same Deck)').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('tda_continue_new_deck').setLabel('Play Again (New Deck)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('tda_continue_leave').setLabel('Leave Game').setStyle(ButtonStyle.Danger)
        )];
    }

    async updateLobbyEmbed(game) {
        const lobbyMessage = await this.client.channels.cache.get(game.channelId).messages.fetch(game.lobbyMessageId).catch(() => null);
        if (!lobbyMessage) return;
        const embed = new EmbedBuilder().setTitle('Three-Dragon Ante Lobby').setColor(0x5539cc).setDescription('Players are gathering... Click "Join" to enter!');
        embed.addFields({ name: 'Game Settings', value: `Buy-in: ${game.buyIn}gp | Timer: ${game.turnTimer / 60} min` });
        let playerList = game.players.map(p => `- ${p.user.username} (${this.manager.SPECIAL_ABILITIES.find(a => a.value === p.specialAbility)?.label || 'No Ability'})`).join('\n') || 'No players yet.';
        embed.addFields({ name: `Players (${game.players.length})`, value: playerList });
        if (game.lobbyExpiresAt) {
            const timeRemaining = Math.round((game.lobbyExpiresAt - Date.now()) / 1000);
            embed.setFooter({ text: `Lobby expires in ${Math.floor(timeRemaining / 60)}m ${timeRemaining % 60}s` });
        }
        await lobbyMessage.edit({ embeds: [embed], components: this._buildLobbyComponents(game) });
    }

    _buildLobbyComponents(game) {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tda_join').setLabel('Join').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('tda_leave').setLabel('Leave').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('tda_start').setLabel('Start Game').setStyle(ButtonStyle.Primary)
        );
        const row2 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('tda_ability_select').setPlaceholder('Choose special ability').addOptions(this.manager.SPECIAL_ABILITIES));
        return [row1, row2];
    }

    async updateScoreboard(game) {
        const scoreboardMessage = await this.client.channels.cache.get(game.channelId).messages.fetch(game.lobbyMessageId).catch(() => null);
        if (!scoreboardMessage) return;
        const embed = new EmbedBuilder().setTitle('Three-Dragon Ante Scoreboard').setColor(0x1ABC9C).setTimestamp();
        let description = `**Stakes:** ${game.gambit.stakes}gp\n\n`;
        [...game.players].sort((a, b) => b.hoard - a.hoard).forEach(p => {
            const flightValue = p.flight.reduce((sum, c) => sum + c.value, 0);
            const isLeader = game.gambit.leader?.id === p.id;
            const isCurrentTurn = game.gambit.turnOrder?.[game.gambit.currentPlayerIndex]?.id === p.id;
            description += `${isCurrentTurn ? '▶️ ' : ''}${isLeader ? '👑 ' : ''}**${p.user.username}**\n> **Hoard:** ${p.hoard}gp | **Flight:** ${flightValue}\n`;
        });
        embed.setDescription(description || 'Scoreboard is empty.');
        await scoreboardMessage.edit({ embeds: [embed], components: [] });
    }
}

module.exports = TdaUiManager;
