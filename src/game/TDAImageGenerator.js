const { createCanvas, loadImage } = require('canvas');
const path = require('path');

const CARD_WIDTH = 150;
const CARD_HEIGHT = 210;
const PADDING = 10;

async function renderHand(cards) {
    const canvas = createCanvas(cards.length * (CARD_WIDTH + PADDING) + PADDING, CARD_HEIGHT + 2 * PADDING);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#36393f'; // Discord dark theme background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        try {
            const imagePath = path.join(__dirname, '..', '..', 'resources', 'tda-cards', card.image);
            const img = await loadImage(imagePath);
            ctx.drawImage(img, PADDING + i * (CARD_WIDTH + PADDING), PADDING, CARD_WIDTH, CARD_HEIGHT);
        } catch (e) {
            console.error(`Failed to load image for card: ${card.name} at path ${card.image}`);
            // Draw a placeholder if image fails to load
            ctx.fillStyle = '#7289da';
            ctx.fillRect(PADDING + i * (CARD_WIDTH + PADDING), PADDING, CARD_WIDTH, CARD_HEIGHT);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(card.name, PADDING + i * (CARD_WIDTH + PADDING) + 10, PADDING + 20);
        }
    }

    return canvas.toBuffer('image/png');
}

async function renderDraftGrid({ cards, buffer, cardToCover }) {
    const GRID_COLS = 5;
    const GRID_ROWS = 4;
    const canvas = createCanvas(GRID_COLS * (CARD_WIDTH + PADDING) + PADDING, GRID_ROWS * (CARD_HEIGHT + PADDING) + PADDING);
    const ctx = canvas.getContext('2d');

    if (buffer) {
        // If a buffer is provided, load it as the base image
        const existingImage = await loadImage(buffer);
        ctx.drawImage(existingImage, 0, 0);
    } else {
        // Otherwise, draw the full grid
        ctx.fillStyle = '#36393f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const row = Math.floor(i / GRID_COLS);
            const col = i % GRID_COLS;
            try {
                const imagePath = path.join(__dirname, '..', '..', 'resources', 'tda-cards', card.image);
                const img = await loadImage(imagePath);
                ctx.drawImage(img, PADDING + col * (CARD_WIDTH + PADDING), PADDING + row * (CARD_HEIGHT + PADDING), CARD_WIDTH, CARD_HEIGHT);
            } catch (e) {
                 console.error(`Failed to load image for card: ${card.name} at path ${card.image}`);
            }
        }
    }

    // If a card needs to be covered, draw a "removed" overlay on it
    if (cardToCover) {
        const cardIndex = cards.findIndex(c => c.name === cardToCover.name && c.value === cardToCover.value);
        if (cardIndex !== -1) {
            const row = Math.floor(cardIndex / GRID_COLS);
            const col = cardIndex % GRID_COLS;
            const x = PADDING + col * (CARD_WIDTH + PADDING);
            const y = PADDING + row * (CARD_HEIGHT + PADDING);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x, y, CARD_WIDTH, CARD_HEIGHT);
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('REMOVED', x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
        }
    }

    return canvas.toBuffer('image/png');
}


module.exports = { renderHand, renderDraftGrid };