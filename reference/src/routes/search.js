/**
 * @file Defines the Express routes for all search-related API endpoints.
 * @author jules
 */

const express = require('express');
const { dataStore } = require('../utils/dataLoader');
const { summarize } = require('../utils/summaryHelper');
const { resolveCopy } = require('../utils/dataProcessor');

const router = express.Router();

/**
 * Handles a generic search for a query within a specific data category.
 * It performs a case-insensitive search on the `name` field of each item.
 * The response is a summarized list of matching items.
 * @param {object} req - The Express request object. Expects a `query` in the body.
 * @param {object} res - The Express response object.
 * @param {string} category - The data category to search within (e.g., 'spells', 'items').
 */
async function handleSearch(req, res, category) {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'A "query" parameter is required.' });
    }

    const items = dataStore.get(category) || [];
    const lowerCaseQuery = query.toLowerCase();
    const results = items.filter(item => item.name && item.name.toLowerCase().includes(lowerCaseQuery));

    if (results.length === 0) {
        return res.json({ results: [] });
    }

    const summary = summarize(category, results, dataStore);
    res.json({ results: summary });
}

/**
 * @route POST /api/oracle/spell
 * @description Searches for spells by name.
 * @body {{query: string}}
 */
router.post('/spell', (req, res) => {
    handleSearch(req, res, 'spells');
});

/**
 * @route POST /api/oracle/item
 * @description Searches for items by name.
 * @body {{query: string}}
 */
router.post('/item', (req, res) => {
    handleSearch(req, res, 'items');
});

/**
 * @route POST /api/oracle/monster
 * @description Searches for monsters by name.
 * @body {{query: string}}
 */
router.post('/monster', (req, res) => {
    handleSearch(req, res, 'bestiary');
});

/**
 * @route POST /api/oracle/feat
 * @description Searches for feats by name.
 * @body {{query: string}}
 */
router.post('/feat', (req, res) => {
    handleSearch(req, res, 'feats');
});

/**
 * @route POST /api/oracle/race
 * @description Searches for races by name.
 * @body {{query: string}}
 */
router.post('/race', (req, res) => {
    handleSearch(req, res, 'races');
});

/**
 * @route POST /api/oracle/background
 * @description Searches for backgrounds by name.
 * @body {{query: string}}
 */
router.post('/background', (req, res) => {
    handleSearch(req, res, 'backgrounds');
});

/**
 * Handles a complex search across all searchable categories.
 * @param {object} req - The Express request object. Expects a `query` in the body.
 * @param {object} res - The Express response object.
 * @param {string} searchType - The type of search: 'name' (searches only item names) or 'content' (searches all string fields).
 */
async function handleComplexSearch(req, res, searchType) {
    const { query } = req.body;
    const { searchableCategories } = require('../utils/dataLoader');

    if (!query) {
        return res.status(400).json({ error: 'A "query" parameter is required.' });
    }

    let allResults = [];
    const lowerCaseQuery = query.toLowerCase();

    // Helper function to recursively search for the query in an item's string fields.
    const deepSearch = (obj) => {
        for (const key in obj) {
            if (typeof obj[key] === 'string' && obj[key].toLowerCase().includes(lowerCaseQuery)) {
                return true;
            }
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                if (deepSearch(obj[key])) return true;
            }
        }
        return false;
    };

    for (const category of searchableCategories) {
        const items = dataStore.get(category) || [];
        const results = items.filter(item => {
            if (!item.name || !item.source) return false;
            const nameMatch = item.name.toLowerCase().includes(lowerCaseQuery);
            if (searchType === 'name') return nameMatch;
            if (searchType === 'content') {
                return nameMatch || deepSearch(item);
            }
            return false;
        }).map(item => ({ ...item, category })); // Add category for context
        allResults.push(...results);
    }

    if (allResults.length === 0) {
        return res.json({ results: [] });
    }

    const summary = allResults.map(item => summarize(item.category, item, dataStore));
    res.json({ results: summary });
}

/**
 * @route POST /api/oracle/5e
 * @description Searches all categories by name.
 * @body {{query: string}}
 */
router.post('/5e', (req, res) => {
    handleComplexSearch(req, res, 'name');
});

/**
 * @route POST /api/oracle/deep
 * @description Searches all categories by name and text content.
 * @body {{query: string}}
 */
router.post('/deep', (req, res) => {
    handleComplexSearch(req, res, 'content');
});

/**
 * @route POST /api/oracle/details
 * @description Retrieves the full data object for a specific item, given its category, name, and source.
 * This endpoint resolves any `_copy` properties to return the complete, final item.
 * @body {{category: string, name: string, source: string}}
 */
router.post('/details', async (req, res) => {
    const { category, name, source } = req.body;

    if (!category || !name || !source) {
        return res.status(400).json({ error: 'Missing required parameters: category, name, source.' });
    }

    const { searchableCategories } = require('../utils/dataLoader');
    if (!searchableCategories.includes(category)) {
        // A simple fallback for the vehicle category which is not in the searchable list
        if (category !== 'vehicles') {
            return res.status(400).json({ error: `Invalid category: ${category}` });
        }
    }

    const items = dataStore.get(category) || [];
    const foundItem = items.find(item => item.name === name && item.source === source);

    if (foundItem) {
        const resolvedItem = resolveCopy(foundItem, category, dataStore);
        res.json(resolvedItem);
    } else {
        res.status(404).json({ error: `Could not find item "${name}" from source "${source}" in category "${category}".` });
    }
});


module.exports = router;
