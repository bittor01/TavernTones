const request = require('supertest');
const { app, setServerReady } = require('../app');
const { dataStore } = require('../utils/dataLoader');

const API_ENDPOINT = '/api/oracle/v2/generate-npc/generate-npc-statblock';

// Mock the data loader to isolate the test
jest.mock('../utils/dataLoader', () => ({
    dataStore: {
        get: jest.fn(),
    },
    // Mock loadData as it's called in app setup, but we don't need it for this test
    loadData: jest.fn(),
}));

describe('Statblock Generator Endpoint', () => {
    // Set the server to a "ready" state before tests run
    beforeAll(() => {
        setServerReady(true);
    });

    const mockBestiary = [
        // Humanoids
        { name: 'Humanoid CR 1', cr: '1', type: 'humanoid' },
        { name: 'Humanoid CR 2', cr: '2', type: { type: 'humanoid', tags: [] } },
        // Fey
        { name: 'Fey CR 3', cr: '3', type: 'fey' },
        // Fiends
        { name: 'Fiend CR 4', cr: '4', type: 'fiend' },
        // Celestials
        { name: 'Celestial CR 5', cr: '5', type: 'celestial' },
        // Beast (for fallback)
        { name: 'Beast CR 6', cr: '6', type: 'beast' },
        // High CR for clamping test
        { name: 'Ancient Dragon', cr: '30', type: 'dragon' },
        // Zero CR for clamping test
        { name: 'Zero Monster', cr: '0', type: 'ooze' },
    ];

    beforeEach(() => {
        // Clear mock calls before each test
        dataStore.get.mockClear();
    });

    test('should return a humanoid when available', async () => {
        dataStore.get.mockReturnValue(mockBestiary);
        const response = await request(app).post(API_ENDPOINT).send({ cr: '1' });
        expect(response.statusCode).toBe(200);
        expect(response.body.medium.name).toBe('Humanoid CR 1');
    });

    test('should fall back to fey if humanoid is not available', async () => {
        const filteredBestiary = mockBestiary.filter(m => m.type !== 'humanoid');
        dataStore.get.mockReturnValue(filteredBestiary);
        const response = await request(app).post(API_ENDPOINT).send({ cr: '3' });
        expect(response.statusCode).toBe(200);
        expect(response.body.medium.name).toBe('Fey CR 3');
    });

    test('should fall back to fiend if humanoid and fey are not available', async () => {
        const filteredBestiary = mockBestiary.filter(m => !['humanoid', 'fey'].includes(m.type));
        dataStore.get.mockReturnValue(filteredBestiary);
        const response = await request(app).post(API_ENDPOINT).send({ cr: '4' });
        expect(response.statusCode).toBe(200);
        expect(response.body.medium.name).toBe('Fiend CR 4');
    });

    test('should fall back to celestial if preferred types are not available', async () => {
        const filteredBestiary = mockBestiary.filter(m => !['humanoid', 'fey', 'fiend'].includes(m.type));
        dataStore.get.mockReturnValue(filteredBestiary);
        const response = await request(app).post(API_ENDPOINT).send({ cr: '5' });
        expect(response.statusCode).toBe(200);
        expect(response.body.medium.name).toBe('Celestial CR 5');
    });

    test('should fall back to a random monster if no preferred types are available', async () => {
        const filteredBestiary = mockBestiary.filter(m => !['humanoid', 'fey', 'fiend', 'celestial'].includes(m.type));
        dataStore.get.mockReturnValue(filteredBestiary);
        const response = await request(app).post(API_ENDPOINT).send({ cr: '6' });
        expect(response.statusCode).toBe(200);
        expect(response.body.medium.name).toBe('Beast CR 6');
    });

    test('should clamp CR to 0 for negative inputs', async () => {
        dataStore.get.mockReturnValue(mockBestiary);
        const response = await request(app).post(API_ENDPOINT).send({ cr: '-5' });
        expect(response.statusCode).toBe(200);
        // The endpoint should have searched for CR 0
        expect(response.body.medium.name).toBe('Zero Monster');
        expect(response.body.medium.cr).toBe('0');
    });

    test('should clamp CR to 30 for inputs greater than 30', async () => {
        dataStore.get.mockReturnValue(mockBestiary);
        const response = await request(app).post(API_ENDPOINT).send({ cr: '40' });
        expect(response.statusCode).toBe(200);
        // The endpoint should have searched for CR 30
        expect(response.body.medium.name).toBe('Ancient Dragon');
        expect(response.body.medium.cr).toBe('30');
    });

    test('should return "N/A" for suggestions when no suitable monster is found', async () => {
        // Provide a bestiary where easy/hard suggestions for CR 2 won't exist
        dataStore.get.mockReturnValue([{ name: 'Humanoid CR 2', cr: '2', type: 'humanoid' }]);
        const response = await request(app).post(API_ENDPOINT).send({ cr: '2' });
        expect(response.statusCode).toBe(200);
        expect(response.body.easy.name).toBe('N/A'); // No monster at CR 0 or 1 in this mock
        expect(response.body.hard.name).toBe('N/A'); // No monster at CR 3 or 4 in this mock
    });
});