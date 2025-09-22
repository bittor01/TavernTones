const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

const IMAGE_DIR = path.join(__dirname, '..', '..', 'resources', 'threedragonanteimages');

/**
 * Renders a player's hand of cards into a single image buffer with overlapping cards.
 * @param {Array<object>} cards - An array of card objects from DECK_DEFINITION.
 * @returns {Promise<Buffer>} A promise that resolves with the image buffer.
 */
async function renderHand(cards) {
    if (!cards || cards.length === 0) {
        const canvas = createCanvas(1, 1); // Return a minimal transparent image
        return canvas.toBuffer('image/png');
    }

    // Load the first card to get dimensions. This assumes all cards are the same size.
    const firstCardPath = path.join(IMAGE_DIR, cards[0].image);
    if (!fs.existsSync(firstCardPath)) {
         console.error(`[renderHand] Base image not found, cannot determine dimensions: ${firstCardPath}`);
         const canvas = createCanvas(1, 1);
         return canvas.toBuffer('image/png');
    }
    const firstCardImage = await loadImage(firstCardPath);
    const cardWidth = firstCardImage.width;
    const cardHeight = firstCardImage.height;

    // Define the overlap. 0.25 means 25% of the card is visible.
    const visiblePart = 0.25;
    const x_offset = cardWidth * visiblePart;

    // Calculate the total width of the canvas
    const canvasWidth = cardWidth + (x_offset * (cards.length - 1));
    const canvasHeight = cardHeight;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const imagePath = path.join(IMAGE_DIR, card.image);
        try {
            if (fs.existsSync(imagePath)) {
                const image = await loadImage(imagePath);
                // Draw each card at an offset
                ctx.drawImage(image, i * x_offset, 0, cardWidth, cardHeight);
            } else {
                throw new Error(`Image not found: ${imagePath}`);
            }
        } catch (error) {
             console.error(`[renderHand] Failed to load or draw card ${card.name}:`, error);
            // Draw a placeholder for the missing/broken image
            ctx.fillStyle = '#4f545c'; // Discord grey
            ctx.fillRect(i * x_offset, 0, cardWidth, cardHeight);
            ctx.strokeStyle = '#dc3545'; // Red
            ctx.lineWidth = 4;
            ctx.strokeRect(i * x_offset, 0, cardWidth, cardHeight);
            ctx.fillStyle = 'white';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(card.name, i * x_offset + cardWidth / 2, cardHeight / 2 - 10);
            ctx.fillText('(Error)', i * x_offset + cardWidth / 2, cardHeight / 2 + 20);
        }
    }

    return canvas.toBuffer('image/png');
}

module.exports = { renderHand };
