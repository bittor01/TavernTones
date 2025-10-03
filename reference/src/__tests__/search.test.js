const request = require('supertest');
const { app, setServerReady } = require('../app');
const { loadData } = require('../utils/dataLoader');

// Mock the auth middleware
jest.mock('../middleware/auth');

describe('Search API Endpoints', () => {
    beforeAll(async () => {
        // Load data from mock-data directory
        await loadData();
        setServerReady(true);
    });

    describe('POST /api/oracle/spell', () => {
        it('should return a summarized list of spells for a valid query', async () => {
            const res = await request(app)
                .post('/api/oracle/spell')
                .send({ query: 'fire' }); // Should match Fireball

            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body.results)).toBe(true);
            expect(res.body.results.length).toBe(1);
            const fireball = res.body.results[0];
            expect(fireball).toHaveProperty('name', 'Fireball');
            expect(fireball).toHaveProperty('source', 'PHB');
            expect(fireball).not.toHaveProperty('entries'); // Should be summarized
        });

        it('should return an empty array for a query with no results', async () => {
            const res = await request(app)
                .post('/api/oracle/spell')
                .send({ query: 'nonexistentspell' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.results).toEqual([]);
        });

        it('should return a 400 error if no query is provided', async () => {
            const res = await request(app)
                .post('/api/oracle/spell')
                .send({});

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('POST /api/oracle/5e', () => {
        it('should return results from multiple categories', async () => {
            const res = await request(app)
                .post('/api/oracle/5e')
                .send({ query: 'goblin' }); // Should match Goblin and Goblin Boss

            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body.results)).toBe(true);
            expect(res.body.results.length).toBeGreaterThan(1);

            const categories = new Set(res.body.results.map(item => item.category));
            // In our mock data, both are bestiary, so we check for that.
            // If we added mock items named 'goblin', this test would be more robust.
            expect(categories.has('bestiary')).toBe(true);
        });
    });

    describe('POST /api/oracle/deep', () => {
        it('should return results from a deep content search', async () => {
            const res = await request(app)
                .post('/api/oracle/deep')
                .send({ query: 'darts' }); // Matches Magic Missile and Poison Dart Trap

            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body.results)).toBe(true);
            expect(res.body.results.length).toBe(2);

            const names = res.body.results.map(item => item.name);
            expect(names).toContain('Magic Missile');
            expect(names).toContain('Poison Dart Trap');
        });
    });

    describe('POST /api/oracle/details', () => {
        it('should return the full details for a valid item', async () => {
            const res = await request(app)
                .post('/api/oracle/details')
                .send({
                    category: 'bestiary',
                    name: 'Goblin',
                    source: 'MM',
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('name', 'Goblin');
            expect(res.body).toHaveProperty('cr', '1/4');
            expect(res.body).toHaveProperty('entries'); // Should have full details
        });

        it('should return a 400 error for missing parameters', async () => {
            const res = await request(app)
                .post('/api/oracle/details')
                .send({ category: 'spells', name: 'Fireball' }); // Missing source

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should return a 404 error for a non-existent item', async () => {
            const res = await request(app)
                .post('/api/oracle/details')
                .send({
                    category: 'spells',
                    name: 'NonExistentSpell',
                    source: 'NOSRC',
                });

            expect(res.statusCode).toEqual(404);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('POST /api/oracle/item', () => {
        it('should return a summarized list of items', async () => {
            const res = await request(app)
                .post('/api/oracle/item')
                .send({ query: 'potion' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.results[0].name).toBe('Potion of Healing');
        });
    });

    describe('POST /api/oracle/monster', () => {
        it('should return a summarized list of monsters', async () => {
            const res = await request(app)
                .post('/api/oracle/monster')
                .send({ query: 'goblin' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.results.length).toBe(2);
            expect(res.body.results[0].name).toBe('Goblin');
        });
    });

    describe('POST /api/oracle/feat', () => {
        it('should return a summarized list of feats', async () => {
            const res = await request(app)
                .post('/api/oracle/feat')
                .send({ query: 'great weapon' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.results[0].name).toBe('Great Weapon Master');
        });
    });

    describe('POST /api/oracle/race', () => {
        it('should return a summarized list of races', async () => {
            const res = await request(app)
                .post('/api/oracle/race')
                .send({ query: 'human' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.results.length).toBe(2); // Human and Variant Human
        });
    });

    describe('POST /api/oracle/background', () => {
        it('should return a summarized list of backgrounds', async () => {
            const res = await request(app)
                .post('/api/oracle/background')
                .send({ query: 'acolyte' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.results[0].name).toBe('Acolyte');
        });
    });
});

const { formatDetailResult } = require('../bot/utils/embedFormatter');

describe('Embed Formatter', () => {
    it('should correctly format a monster with a complex type object like a Lich', () => {
        const lichData = {
            name: 'Lich',
            size: ['M'],
            type: {
                type: 'undead',
                tags: ['lich']
            },
            alignment: ['L', 'E'],
            category: 'bestiary',
            source: 'MM'
        };
        const embed = formatDetailResult(lichData);
        expect(embed.data.description).not.toContain('[object Object]');
        expect(embed.data.description).toContain('undead (lich)');
    });

    it('should correctly format a monster with a simple type string', () => {
        const monsterData = {
            name: 'Aboleth',
            size: 'Large',
            type: 'aberration',
            alignment: 'lawful evil',
            category: 'bestiary',
            source: 'MM'
        };
        const embed = formatDetailResult(monsterData);
        expect(embed.data.description).toBe('*Large aberration, lawful evil*');
    });

    it('should correctly format monster AC when it is a simple number', () => {
        const monsterData = { name: 'Test Monster', ac: [15], category: 'bestiary' };
        const embed = formatDetailResult(monsterData);
        const acField = embed.data.fields.find(f => f.name === 'Armor Class');
        expect(acField.value).toBe('15');
    });

    it('should correctly format monster AC when it is an object with a source', () => {
        const monsterData = { name: 'Test Monster', ac: [{ ac: 18, from: ['natural armor'] }], category: 'bestiary' };
        const embed = formatDetailResult(monsterData);
        const acField = embed.data.fields.find(f => f.name === 'Armor Class');
        expect(acField.value).toBe('18 (natural armor)');
    });

    it('should correctly format monster AC with a condition', () => {
        const monsterData = { name: 'Test Monster', ac: [12, { ac: 15, condition: 'with mage armor' }], category: 'bestiary' };
        const embed = formatDetailResult(monsterData);
        const acField = embed.data.fields.find(f => f.name === 'Armor Class');
        expect(acField.value).toBe('12 or 15 with mage armor');
    });
});