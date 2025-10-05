/**
 * @file Manages the complex, form-based interaction for the V2 NPC generator.
 * This class orchestrates the entire process, from fetching initial form options
 * to building dynamic embeds and components, handling user selections, and
 * finally submitting the data to the API to generate the NPC.
 * @author jules
 */

const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');
const { getOrCreateSession, deleteSession } = require('./botSessionManager');
const { EMBED_COLORS } = require('./embedColors');
const { formatDetailResult } = require('./embedFormatter');

const API_BASE_URL = 'http://localhost:3000/api/oracle/v2/generate-npc';
const PAGE_SIZE = 22; // Max 25 options, leaving space for pagination/random buttons.

/**
 * Parses a selection value (e.g., "Dwarf|PHB") into just its name part.
 * @private
 * @param {string} value The combined value string.
 * @returns {string} The display name.
 */
const parseName = (value) => (value ? value.split('|')[0] : 'Not Selected');

/**
 * Handles the state and interactions for the multi-step NPC generation form.
 */
class NpcFormHandler {
    /**
     * @param {import('discord.js').Interaction} interaction The initial command interaction.
     */
    constructor(interaction) {
        this.interaction = interaction;
        this.sessionId = interaction.id;
        getOrCreateSession(this.sessionId);
    }

    /**
     * Starts the NPC form interaction. Fetches initial data from the API
     * and displays the first version of the form to the user.
     */
    async start() {
        try {
            const response = await axios.get(`${API_BASE_URL}/options`);
            const session = getOrCreateSession(this.sessionId);
            session.formOptions = response.data;
            session.selections = { mode: 'idea' };
            session.pages = { species: 0, class: 0, background: 0, lineage: 0, subclass: 0 };

            const embed = this.buildEmbed();
            const components = this.buildComponents();
            const message = await this.interaction.editReply({ embeds: [embed], components, ephemeral: true });
            this.startCollector(message);
        } catch (error) {
            console.error('Failed to start NPC form handler:', error);
            this.interaction.editReply('Sorry, I couldn\'t load the NPC generator options.');
            deleteSession(this.sessionId);
        }
    }

    /**
     * Builds the main status embed that shows the user's current selections.
     * @returns {EmbedBuilder} The configured embed.
     */
    buildEmbed() {
        const { selections } = getOrCreateSession(this.sessionId);
        const embed = new EmbedBuilder()
            .setColor(EMBED_COLORS.CHARACTER)
            .setTitle('NPC Generator')
            .setDescription('Select your options below and click "Generate" when you\'re ready.')
            .addFields(
                { name: 'Mode', value: selections.mode || 'Not Selected', inline: true },
                { name: 'Species', value: parseName(selections.species), inline: true },
                { name: 'Lineage', value: parseName(selections.lineage) || 'N/A', inline: true },
                { name: 'Class', value: parseName(selections.class), inline: true },
                { name: 'Subclass', value: parseName(selections.subclass) || 'N/A', inline: true },
                { name: 'Background', value: parseName(selections.background), inline: true },
            );
        if (selections.mode === 'npc') {
            embed.addFields({ name: 'Challenge Rating', value: selections.cr || 'Not Selected', inline: true });
        }
        return embed;
    }

    /**
     * Builds all the message components (select menus, buttons) for the form.
     * This is dynamic, showing lineage/subclass menus only after a species/class is chosen.
     * @returns {ActionRowBuilder[]} An array of action rows containing the components.
     */
    buildComponents() {
        const session = getOrCreateSession(this.sessionId);
        const { formOptions, selections, pages, lineageOptions, subclassOptions } = session;
        const rows = [];
        const createValue = item => `${item.name}|${item.source}`;

        const buildPaginatedMenu = (id, placeholder, allItems, page, staticOptions = []) => {
            const menu = new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder);
            const start = page * PAGE_SIZE;
            const end = start + PAGE_SIZE;
            const pageItems = allItems.slice(start, end);
            const finalOptions = [...staticOptions, ...pageItems.map(item => ({ label: `${item.name} [${item.source}]`, value: createValue(item) }))];
            if (page > 0) finalOptions.unshift({ label: '⬅️ Previous Page', value: 'pagination_prev' });
            if (end < allItems.length) finalOptions.push({ label: 'Next Page ➡️', value: 'pagination_next' });
            menu.addOptions(finalOptions);
            return menu;
        };

        const modePlaceholder = `Mode: ${selections.mode.charAt(0).toUpperCase() + selections.mode.slice(1)}`;
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('npc-mode').setPlaceholder(modePlaceholder).addOptions([{ label: 'Just an Idea', value: 'idea', description: 'Concept with species, class, background.' }, { label: 'Full NPC Statblock', value: 'npc', description: 'Includes a suggested statblock.' }])));

        const speciesInfo = selections.species ? formOptions.species.find(s => createValue(s) === selections.species) : null;
        if (speciesInfo?.hasLineages) {
            const placeholder = selections.lineage ? `Lineage: ${parseName(selections.lineage)}` : `Select a Lineage for ${parseName(selections.species)}`;
            rows.push(new ActionRowBuilder().addComponents(buildPaginatedMenu('npc-lineage', placeholder, lineageOptions || [], pages.lineage, [{ label: '↩️ Back to Species', value: 'go_back_species' }])));
        } else {
            const placeholder = selections.species ? `Species: ${parseName(selections.species)}` : 'Select a Species';
            rows.push(new ActionRowBuilder().addComponents(buildPaginatedMenu('npc-species', placeholder, formOptions.species, pages.species, [{ label: '🎲 Random Species', value: 'random' }])));
        }

        const classInfo = selections.class ? formOptions.classes.find(c => createValue(c) === selections.class) : null;
        if (classInfo?.hasSubclasses) {
            const placeholder = selections.subclass ? `Subclass: ${parseName(selections.subclass)}` : `Select a Subclass for ${parseName(selections.class)}`;
            rows.push(new ActionRowBuilder().addComponents(buildPaginatedMenu('npc-subclass', placeholder, subclassOptions || [], pages.subclass, [{ label: '↩️ Back to Class', value: 'go_back_class' }])));
        } else {
            const placeholder = selections.class ? `Class: ${parseName(selections.class)}` : 'Select a Class';
            rows.push(new ActionRowBuilder().addComponents(buildPaginatedMenu('npc-class', placeholder, formOptions.classes, pages.class, [{ label: '🎲 Random Class', value: 'random' }])));
        }

        const backgroundPlaceholder = selections.background ? `Background: ${parseName(selections.background)}` : 'Select a Background';
        rows.push(new ActionRowBuilder().addComponents(buildPaginatedMenu('npc-background', backgroundPlaceholder, formOptions.backgrounds, pages.background, [{ label: '🎲 Random Background', value: 'random' }])));

        rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('npc-submit').setLabel('Generate').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('npc-cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)));
        return rows;
    }

    /**
     * Starts the master component collector that listens for all interactions with the form.
     * @param {import('discord.js').Message} message The message the form is attached to.
     */
    startCollector(message) {
        const collector = message.createMessageComponentCollector({ filter: i => i.user.id === this.interaction.user.id, time: 300000 });

        collector.on('collect', async i => {
            const session = getOrCreateSession(this.sessionId);
            try {
                if (i.isStringSelectMenu()) {
                    await i.deferUpdate();
                    await this.handleSelectMenu(i, session);
                } else if (i.isButton()) {
                    if (i.customId === 'npc-submit') {
                        if (session.selections.mode === 'npc') await this.showCrModal(i);
                        else {
                            await this.submitForm(i);
                            collector.stop('user');
                        }
                    } else if (i.customId === 'npc-cancel') {
                        await this.interaction.editReply({ content: 'NPC generation cancelled.', embeds: [], components: [] });
                        collector.stop('user');
                    }
                    return;
                }
                await this.interaction.editReply({ embeds: [this.buildEmbed()], components: this.buildComponents() });
            } catch (error) {
                console.error('Error during NPC form interaction:', error);
                await this.interaction.editReply({ content: 'An error occurred. Please try again.', embeds: [], components: [] }).catch(() => {});
                collector.stop('error');
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason !== 'user' && reason !== 'error') this.interaction.editReply({ content: 'This interaction has expired.', embeds: [], components: [] }).catch(() => {});
            deleteSession(this.sessionId);
        });
    }

    /**
     * Handles logic for when a user interacts with a select menu.
     * This includes pagination, going "back", and fetching dynamic options.
     * @param {import('discord.js').StringSelectMenuInteraction} i The interaction from the select menu.
     * @param {object} session The current session object.
     */
    async handleSelectMenu(i, session) {
        const type = i.customId.replace('npc-', '');
        const value = i.values[0];

        if (type === 'mode' && value === 'idea') delete session.selections.cr;

        if (value === 'pagination_next') session.pages[type]++;
        else if (value === 'pagination_prev') session.pages[type]--;
        else if (value.startsWith('go_back_')) {
            const field = value.split('_')[2];
            delete session.selections[field];
            if (field === 'species') delete session.selections.lineage;
            if (field === 'class') delete session.selections.subclass;
        } else {
            session.selections[type] = value;
            if (session.pages[type] !== undefined) session.pages[type] = 0;

            if (type === 'species') {
                delete session.selections.lineage;
                session.pages.lineage = 0;
                if (value !== 'random') {
                    const speciesInfo = session.formOptions.species.find(s => `${s.name}|${s.source}` === value);
                    if (speciesInfo?.hasLineages) {
                        const response = await axios.get(`${API_BASE_URL}/lineages/${parseName(value)}`);
                        session.lineageOptions = response.data;
                    } else delete session.lineageOptions;
                } else delete session.lineageOptions;
            }

            if (type === 'class') {
                delete session.selections.subclass;
                session.pages.subclass = 0;
                if (value !== 'random') {
                    const classInfo = session.formOptions.classes.find(c => `${c.name}|${c.source}` === value);
                    if (classInfo?.hasSubclasses) {
                        const response = await axios.get(`${API_BASE_URL}/subclasses/${parseName(value)}`);
                        session.subclassOptions = response.data;
                    } else delete session.subclassOptions;
                } else delete session.subclassOptions;
            }
        }
    }

    /**
     * Displays a modal window to the user to input a Challenge Rating.
     * @param {import('discord.js').ButtonInteraction} i The button interaction that triggered the modal.
     */
    async showCrModal(i) {
        const modal = new ModalBuilder().setCustomId(`cr-modal-${this.sessionId}`).setTitle('Challenge Rating');
        const crInput = new TextInputBuilder().setCustomId('cr-input').setLabel("Enter a Challenge Rating (e.g., 1/2, 5)").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(crInput));
        await i.showModal(modal);
    }

    /**
     * Submits the final form data to the API and formats the response.
     * This also handles the complex logic of fetching and displaying statblock suggestions in a new thread.
     * @param {import('discord.js').Interaction} i The interaction that triggered the submission (button or modal).
     * @param {string|null} [cr=null] The Challenge Rating, if provided via the modal.
     */
    async submitForm(i, cr = null) {
        await i.update({ content: 'Generating your NPC, please wait...', embeds: [], components: [] });
        const session = getOrCreateSession(this.sessionId);
        try {
            const payload = { ...session.selections };
            if (cr) payload.cr = cr;

            const response = await axios.post(`${API_BASE_URL}/create`, payload);
            const { npc } = response.data;
            const finalEmbed = this.buildFinalEmbed(npc);

            const message = await this.interaction.followUp({ embeds: [finalEmbed], ephemeral: false });

            if (npc.statblockSuggestions) {
                try {
                    const thread = await message.startThread({ name: `${npc.name || 'NPC'} Statblock Suggestions`, autoArchiveDuration: 60 });
                    const { easy, medium, hard } = npc.statblockSuggestions;
                    const oracleBaseUrl = API_BASE_URL.replace('/v2/generate-npc', '');

                    const getFullMonsterDetails = async (suggestion) => {
                        if (!suggestion || !suggestion.name || suggestion.name === 'N/A') return null;
                        try {
                            const searchResponse = await axios.post(`${oracleBaseUrl}/5e`, { query: suggestion.name });
                            const results = searchResponse.data.results;
                            if (!results?.length) return new EmbedBuilder().setColor(EMBED_COLORS.WARNING).setTitle(`${suggestion.name} (CR ${suggestion.cr})`).setDescription('Could not find a full statblock.');
                            const monsterIdentity = results.find(r => r.category === 'bestiary' && r.name.toLowerCase() === suggestion.name.toLowerCase()) || results.find(r => r.category === 'bestiary') || results[0];
                            const detailResponse = await axios.post(`${oracleBaseUrl}/details`, { category: monsterIdentity.category, name: monsterIdentity.name, source: monsterIdentity.source });
                            return formatDetailResult({ ...detailResponse.data, category: monsterIdentity.category });
                        } catch (error) {
                            return new EmbedBuilder().setColor(EMBED_COLORS.ERROR).setTitle(`${suggestion.name} (CR ${suggestion.cr})`).setDescription('An error occurred while fetching the full statblock.');
                        }
                    };

                    const [easyResult, mediumResult, hardResult] = await Promise.all([ getFullMonsterDetails(easy), getFullMonsterDetails(medium), getFullMonsterDetails(hard) ]);
                    const finalEmbeds = [];
                    if (easyResult) finalEmbeds.push(easyResult.setTitle(`Easy Suggestion: ${easy.name}`).setColor(EMBED_COLORS.SUCCESS));
                    if (mediumResult) finalEmbeds.push(mediumResult.setTitle(`Medium Suggestion: ${medium.name}`).setColor(EMBED_COLORS.WARNING));
                    if (hardResult) finalEmbeds.push(hardResult.setTitle(`Hard Suggestion: ${hard.name}`).setColor(EMBED_COLORS.ERROR));

                    if (finalEmbeds.length > 0) await thread.send({ embeds: finalEmbeds });
                    else await thread.send({ content: 'I found some suggestions, but was unable to retrieve their statblocks.'});
                } catch (threadError) {
                    console.error('[NpcFormHandler] CRITICAL: Failed during thread creation or sending.', threadError);
                    await this.interaction.followUp({ content: 'I created the NPC, but failed to post the statblock suggestions. Please check my permissions to create threads and send messages in them.', ephemeral: true }).catch(() => {});
                }
            }

            await this.interaction.deleteReply().catch(() => {});
        } catch (error) {
            console.error('Failed to submit NPC form:', error.response ? error.response.data : error.message);
            await this.interaction.followUp({ content: 'Sorry, there was an error generating your NPC.', ephemeral: true });
        }
    }

    /**
     * Builds the final embed that displays the generated NPC's details.
     * @param {object} npc The final NPC object from the API.
     * @returns {EmbedBuilder} The final, formatted embed.
     */
    buildFinalEmbed(npc) {
        const descriptionParts = [];
        const speciesString = (npc.lineage?.name && Object.keys(npc.lineage).length > 0) ? npc.lineage.name : (npc.species?.name || 'N/A');
        descriptionParts.push(speciesString);

        if (npc.class?.name) {
            const className = npc.class.name;
            const subclassName = (npc.subclass?.name && Object.keys(npc.subclass).length > 0) ? npc.subclass.name : null;
            descriptionParts.push(subclassName ? `${subclassName} ${className}` : className);
        } else {
            descriptionParts.push('N/A');
        }

        descriptionParts.push(npc.background?.name ? `from a ${npc.background.name} background.` : 'from an unknown background.');
        const formatTraitList = (traits) => (traits && traits.length > 0 ? traits.map(t => `- ${t}`).join('\n') : 'N/A');

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLORS.CHARACTER)
            .setTitle(npc.name || 'NPC Generated')
            .setDescription(descriptionParts.join(' '))
            .addFields(
                { name: 'Trait', value: formatTraitList(npc.trait), inline: false },
                { name: 'Ideal', value: formatTraitList(npc.ideal), inline: false },
                { name: 'Bond', value: formatTraitList(npc.bond), inline: false },
                { name: 'Flaw', value: formatTraitList(npc.flaw), inline: false },
            );

        if (npc.statblockSuggestions) {
            embed.setFooter({ text: 'Statblock suggestions are in the thread below.' });
        }

        return embed;
    }
}

module.exports = { NpcFormHandler };