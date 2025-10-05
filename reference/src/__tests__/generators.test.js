const request = require('supertest');
const { app, setServerReady } = require('../app');
const { loadData } = require('../utils/dataLoader');
const { getOrCreateSession, deleteSession } = require('../bot/utils/botSessionManager');
const { EventEmitter } = require('events');
const { NpcFormHandler } = require('../bot/utils/npcFormHandler');
const axios = require('axios');

// --- Mocking ---
jest.mock('../middleware/auth');
jest.mock('axios');

// Helper function to get a numerical value for a CR string (e.g., "1/2" -> 0.5)
function getCrValue(cr) {
    if (!cr) return 0;
    if (cr.toString().includes('/')) {
        const parts = cr.toString().split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(cr);
}

// --- Mocking Utilities for NpcFormHandler ---
class MockCollector extends EventEmitter {
    constructor() {
        super();
        this.stop = jest.fn();
    }
    simulate(event, ...args) {
        this.emit(event, ...args);
    }
}

const getMockInteraction = (componentCollector) => {
    const mockThread = {
        send: jest.fn().mockResolvedValue(true),
    };
    const mockMessage = {
        startThread: jest.fn().mockResolvedValue(mockThread),
    };
    const mock = {
        id: 'unique-interaction-id',
        user: { id: 'unique-user-id' },
        editReply: jest.fn(),
        deleteReply: jest.fn().mockResolvedValue(true),
        followUp: jest.fn().mockResolvedValue(mockMessage), // followUp returns a message object
        reply: jest.fn().mockResolvedValue(true),
        showModal: jest.fn(),
        update: jest.fn(),
        replied: false,
        deferred: false,
    };
    mock.editReply.mockResolvedValue({
        createMessageComponentCollector: jest.fn().mockReturnValue(componentCollector),
    });
    return mock;
};

// --- Test Suites ---
describe('Generator Tests', () => {
    beforeAll(async () => {
        await loadData();
        setServerReady(true);
    });

    afterEach(() => {
        deleteSession('unique-interaction-id');
        jest.clearAllMocks();
    });

    describe('V2 NPC Generator API', () => {
        beforeEach(() => {
            // Mock the internal API call that NpcGenerator makes to the statblock endpoint
            axios.post.mockImplementation(async (url, data) => {
                if (url.includes('generate-npc-statblock')) {
                    if (data.cr === '1') {
                        return { data: { medium: { name: 'Goblin Boss', cr: '1' } } };
                    }
                    if (data.cr === '1/4') {
                        return { data: { medium: { name: 'Wolf', cr: '1/4' } } };
                    }
                }
                // For the NpcFormHandler test that calls '/create'
                if (url.includes('/create')) {
                    return { data: { npc: { name: 'Mocked NPC' } } };
                }
                return { data: {} }; // Default empty response
            });
        });

        it('should create an NPC with the correct statblock suggestion', async () => {
            const payload = { mode: 'npc', cr: '1' };
            const res = await request(app).post('/api/oracle/v2/generate-npc/create').send(payload);

            expect(res.statusCode).toEqual(200);
            const { npc } = res.body;
            expect(npc.statblockSuggestions).toBeDefined();
            expect(npc.statblockSuggestions.medium.name).toBe('Goblin Boss');
            expect(getCrValue(npc.statblockSuggestions.medium.cr)).toBe(1);
        });

        it('should create an NPC with a different statblock suggestion for a different CR', async () => {
            const payload = { mode: 'npc', cr: '1/4' };
            const res = await request(app).post('/api/oracle/v2/generate-npc/create').send(payload);

            expect(res.statusCode).toEqual(200);
            const { npc } = res.body;
            expect(npc.statblockSuggestions).toBeDefined();
            expect(npc.statblockSuggestions.medium.name).toBe('Wolf');
            expect(getCrValue(npc.statblockSuggestions.medium.cr)).toBe(0.25);
        });
    });

    describe('NpcFormHandler', () => {
        let mockInteraction;
        let mockComponentCollector;

        const mockApiOptions = {
            species: [{ name: 'Human', source: 'PHB', hasLineages: true }],
            classes: [{ name: 'Fighter', source: 'PHB', hasSubclasses: true }],
            backgrounds: [{ name: 'Acolyte', source: 'PHB' }],
        };
        const mockFinalNpc = {
            name: 'Sir Testy',
            species: { name: 'Human' },
            class: { name: 'Fighter' },
            background: { name: 'Acolyte' },
            trait: ['Brave'], ideal: ['Justice'], bond: ['My sword'], flaw: ['Greedy'],
            statblockSuggestions: {
                easy: { name: 'Thug', cr: '1/2' },
                medium: { name: 'Knight', cr: '3' },
                hard: { name: 'Veteran', cr: '5' },
            }
        };

        beforeEach(() => {
            mockComponentCollector = new MockCollector();
            mockInteraction = getMockInteraction(mockComponentCollector);
            axios.get.mockResolvedValue({ data: mockApiOptions });
            axios.post.mockResolvedValue({ data: { npc: mockFinalNpc } });
        });

        it('should handle the full statblock generation flow using CR and threaded replies', async () => {
            const handler = new NpcFormHandler(mockInteraction);
            await handler.start();

            const session = getOrCreateSession(handler.sessionId);
            session.selections = { mode: 'npc', species: 'Human|PHB' };

            const buttonInteraction = {
                update: mockInteraction.update,
                followUp: mockInteraction.followUp,
                deleteReply: mockInteraction.deleteReply,
            };

            // Simulate providing CR '3' from the modal
            await handler.submitForm(buttonInteraction, '3');

            // Check that the form is updated to show a "generating" message
            expect(buttonInteraction.update).toHaveBeenCalledWith({
                content: 'Generating your NPC, please wait...',
                embeds: [],
                components: [],
            });

            // Check that the final embed is sent and contains the footer
            expect(mockInteraction.followUp).toHaveBeenCalled();
            const finalEmbed = mockInteraction.followUp.mock.calls[0][0].embeds[0];
            expect(finalEmbed.data.title).toBe('Sir Testy');
            expect(finalEmbed.data.footer.text).toBe('Statblock suggestions are in the thread below.');
            // Ensure statblock fields are NOT in the main embed
            expect(finalEmbed.data.fields).not.toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Easy Statblock' }),
                ])
            );

            // Check that a thread was created and embeds were sent to it
            const mockMessage = await mockInteraction.followUp.mock.results[0].value;
            expect(mockMessage.startThread).toHaveBeenCalled();
            const mockThread = await mockMessage.startThread.mock.results[0].value;
            expect(mockThread.send).toHaveBeenCalledTimes(1);
            // Verify that the single call to send included an array of 3 embeds
            expect(mockThread.send.mock.calls[0][0].embeds).toHaveLength(3);
        });
    });
});