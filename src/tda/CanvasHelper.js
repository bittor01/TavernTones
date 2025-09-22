const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

const IMAGE_DIR = path.join(__dirname, '..', '..', 'resources', 'threedragonanteimages');

/**
 * Renders a player's hand of cards into a single image buffer, side-by-side.
 * @param {Array<object>} cards - An array of card objects.
 * @returns {Promise<Buffer>} A promise that resolves with the image buffer.
 */
async function renderHand(cards) {
    if (!cards || cards.length === 0) {
        const canvas = createCanvas(1, 1);
        return canvas.toBuffer('image/png');
    }

    const firstCardImage = await loadImage(path.join(IMAGE_DIR, cards[0].image));
    const cardWidth = firstCardImage.width;
    const cardHeight = firstCardImage.height;

    const canvasWidth = cardWidth * cards.length;
    const canvasHeight = cardHeight;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const imagePath = path.join(IMAGE_DIR, card.image);
        try {
            if (fs.existsSync(imagePath)) {
                const image = await loadImage(imagePath);
                ctx.drawImage(image, i * cardWidth, 0, cardWidth, cardHeight);
            } else { throw new Error(`Image not found`); }
        } catch (error) {
             console.error(`[renderHand] Failed to load or draw card ${card.name}: ${error.message}`);
             ctx.fillStyle = '#4f545c';
             ctx.fillRect(i * cardWidth, 0, cardWidth, cardHeight);
             ctx.fillStyle = 'white';
             ctx.textAlign = 'center';
             ctx.fillText(card.name, i * cardWidth + cardWidth / 2, cardHeight / 2);
        }
    }

    return canvas.toBuffer('image/png');
}

/**
 * Renders the draft pool into a 5x4 grid.
 * @param {Array<object>} cards - The array of cards in the draft pool.
 * @returns {Promise<Buffer>} A promise that resolves with the image buffer.
 */
async function renderDraftGrid(cards) {
    if (!cards || cards.length === 0) {
        const canvas = createCanvas(1, 1);
        return canvas.toBuffer('image/png');
    }

    const firstCardImage = await loadImage(path.join(IMAGE_DIR, cards[0].image));
    const cardWidth = firstCardImage.width;
    const cardHeight = firstCardImage.height;

    const cols = 5;
    const rows = 4;
    const canvasWidth = cardWidth * cols;
    const canvasHeight = cardHeight * rows;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * cardWidth;
        const y = row * cardHeight;

        const imagePath = path.join(IMAGE_DIR, card.image);
        try {
            if (fs.existsSync(imagePath)) {
                const image = await loadImage(imagePath);
                ctx.drawImage(image, x, y, cardWidth, cardHeight);
            } else { throw new Error(`Image not found`); }
        } catch (error) {
            console.error(`[renderDraftGrid] Failed to load or draw card ${card.name}: ${error.message}`);
            ctx.fillStyle = '#4f545c';
            ctx.fillRect(x, y, cardWidth, cardHeight);
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText(card.name, x + cardWidth / 2, y + cardHeight / 2);
        }
    }
    return canvas.toBuffer('image/png');
}


module.exports = { renderHand, renderDraftGrid };
