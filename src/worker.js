const { parentPort } = require('worker_threads');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

const IMAGE_DIR = path.join(__dirname, '..', 'resources', 'threedragonanteimages');
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

async function renderHand(cards) {
    if (!cards || cards.length === 0) {
        const canvas = createCanvas(1, 1);
        return canvas.toBuffer('image/png');
    }

    // Dynamically calculate the scaling factor
    const firstCardImage = await loadImage(path.join(IMAGE_DIR, cards[0].image));
    const cardWidth = firstCardImage.width;
    const cardHeight = firstCardImage.height;
    const initialSize = cardWidth * cardHeight * 4 * cards.length;
    const scale = Math.min(1.0, Math.sqrt(MAX_FILE_SIZE / initialSize));

    const scaledWidth = Math.floor(cardWidth * scale);
    const scaledHeight = Math.floor(cardHeight * scale);

    const canvasWidth = scaledWidth * cards.length;
    const canvasHeight = scaledHeight;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const imagePath = path.join(IMAGE_DIR, card.image);
        try {
            if (fs.existsSync(imagePath)) {
                const image = await loadImage(imagePath);
                ctx.drawImage(image, i * scaledWidth, 0, scaledWidth, scaledHeight);
            } else { throw new Error(`Image not found`); }
        } catch (error) {
             console.error(`[renderHand] Failed to load or draw card ${card.name}: ${error.message}`);
             ctx.fillStyle = '#4f545c';
             ctx.fillRect(i * scaledWidth, 0, scaledWidth, scaledHeight);
             ctx.fillStyle = 'white';
             ctx.textAlign = 'center';
             ctx.fillText(card.name, i * scaledWidth + scaledWidth / 2, scaledHeight / 2);
        }
    }

    return canvas.toBuffer('image/png');
}

async function renderDraftGrid(cards) {
    if (!cards || cards.length === 0) {
        const canvas = createCanvas(1, 1);
        return canvas.toBuffer('image/png');
    }

    // Dynamically calculate the scaling factor
    const firstCardImage = await loadImage(path.join(IMAGE_DIR, cards[0].image));
    const cardWidth = firstCardImage.width;
    const cardHeight = firstCardImage.height;
    const initialSize = cardWidth * cardHeight * 4 * cards.length;
    const scale = Math.min(1.0, Math.sqrt(MAX_FILE_SIZE / initialSize));

    const scaledWidth = Math.floor(cardWidth * scale);
    const scaledHeight = Math.floor(cardHeight * scale);

    const cols = 5;
    const rows = Math.ceil(cards.length / cols);
    const canvasWidth = scaledWidth * cols;
    const canvasHeight = scaledHeight * rows;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * scaledWidth;
        const y = row * scaledHeight;

        const imagePath = path.join(IMAGE_DIR, card.image);
        try {
            if (fs.existsSync(imagePath)) {
                const image = await loadImage(imagePath);
                ctx.drawImage(image, x, y, scaledWidth, scaledHeight);
            } else { throw new Error(`Image not found`); }
        } catch (error) {
            console.error(`[renderDraftGrid] Failed to load or draw card ${card.name}: ${error.message}`);
            ctx.fillStyle = '#4f545c';
            ctx.fillRect(x, y, scaledWidth, scaledHeight);
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText(card.name, x + scaledWidth / 2, y + scaledHeight / 2);
        }
    }
    return canvas.toBuffer('image/png');
}

async function cacheMusic(filePath, shell) {
    try {
        let resolvedPath = filePath;
        // The shell object cannot be passed to the worker, so this logic is commented out.
        // The main thread should resolve shortcuts before calling the worker.
        // if (shell && path.extname(resolvedPath).toLowerCase() === '.lnk') {
        //     ...
        // }
        const buffer = fs.readFileSync(resolvedPath);
        return { buffer, resolvedPath };
    } catch (error) {
        // Errors in the worker need to be serializable to be sent back
        throw new Error(error.message);
    }
}


const tasks = {
    renderHand,
    renderDraftGrid,
    cacheMusic,
};

parentPort.on('message', async ({ task, args, correlationId }) => {
    try {
        if (tasks[task]) {
            const result = await tasks[task](...args);
            // When sending a buffer, it's safer to convert it to a plain object
            // as some worker implementations might have issues with direct Buffer transfers.
            if (result instanceof Buffer) {
                 parentPort.postMessage({ correlationId, result: { type: 'Buffer', data: Array.from(result) } });
            } else {
                 parentPort.postMessage({ correlationId, result });
            }
        } else {
            throw new Error(`Unknown task: ${task}`);
        }
    } catch (error) {
        parentPort.postMessage({ correlationId, error: error.message || 'An unknown error occurred' });
    }
});
