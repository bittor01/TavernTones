const { parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

function log(message) {
    parentPort.postMessage({ type: 'log', message });
}

// --- Music Caching ---
function cacheMusic(filePath) {
    log(`[Worker] Caching music file: ${filePath}`);
    try {
        return fs.readFileSync(filePath);
    } catch (error) {
        log(`[Worker] Error caching file ${filePath}: ${error.message}`);
        throw error;
    }
}

// --- TDA Image Generation ---
const IMAGE_DIR = path.join(__dirname, '..', 'resources', 'threedragonanteimages');
const MAX_IMAGE_SIZE_BYTES = 7 * 1024 * 1024;

let handScalingFactor = null;
let draftScalingFactor = null;

async function renderHand(cards) {
    if (!cards || cards.length === 0) return createCanvas(1, 1).toBuffer('image/png');
    if (!handScalingFactor) handScalingFactor = await getHandScalingFactor();

    const firstCardImage = await loadImage(path.join(IMAGE_DIR, cards[0].image));
    const cardWidth = firstCardImage.width * handScalingFactor;
    const cardHeight = firstCardImage.height * handScalingFactor;
    const canvas = createCanvas(cardWidth * cards.length, cardHeight);
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const imagePath = path.join(IMAGE_DIR, card.image);
        try {
            const image = await loadImage(imagePath);
            ctx.drawImage(image, i * cardWidth, 0, cardWidth, cardHeight);
        } catch (error) {
             log(`[renderHand] Failed to draw ${card.name}: ${error.message}`);
             ctx.fillStyle = '#4f545c';
             ctx.fillRect(i * cardWidth, 0, cardWidth, cardHeight);
             ctx.fillStyle = 'white';
             ctx.textAlign = 'center';
             ctx.fillText(card.name, i * cardWidth + cardWidth / 2, cardHeight / 2);
        }
    }
    return canvas.toBuffer('image/png');
}

async function renderDraftGrid(cards) {
    if (!cards || cards.length === 0) return createCanvas(1, 1).toBuffer('image/png');
    if (!draftScalingFactor) draftScalingFactor = await getDraftScalingFactor();

    const firstCardImage = await loadImage(path.join(IMAGE_DIR, cards[0].image));
    const cardWidth = firstCardImage.width * draftScalingFactor;
    const cardHeight = firstCardImage.height * draftScalingFactor;
    const cols = 5;
    const rows = 4;
    const canvas = createCanvas(cardWidth * cols, cardHeight * rows);
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        try {
            const image = await loadImage(path.join(IMAGE_DIR, card.image));
            ctx.drawImage(image, col * cardWidth, row * cardHeight, cardWidth, cardHeight);
        } catch (error) {
            log(`[renderDraftGrid] Failed to draw ${card.name}: ${error.message}`);
            ctx.fillStyle = '#4f545c';
            ctx.fillRect(col * cardWidth, row * cardHeight, cardWidth, cardHeight);
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText(card.name, col * cardWidth + cardWidth / 2, row * cardHeight + cardHeight / 2);
        }
    }
    return canvas.toBuffer('image/png');
}

async function getHandScalingFactor() {
    log('Calculating hand scaling factor...');
    const allImages = fs.readdirSync(IMAGE_DIR);
    const largestImages = allImages
        .map(img => ({ name: img, size: fs.statSync(path.join(IMAGE_DIR, img)).size }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
        .map(img => ({ image: img.name }));

    if (largestImages.length === 0) return 1.0;

    let scalingFactor = 1.0;
    for (let i = 0; i < 5; i++) {
        const buffer = await renderHand(largestImages);
        if (buffer.length < MAX_IMAGE_SIZE_BYTES) {
            log(`Hand scaling factor set to ${scalingFactor}`);
            return scalingFactor;
        }
        scalingFactor *= 0.9;
    }
    return scalingFactor;
}

async function getDraftScalingFactor() {
    log('Calculating draft scaling factor...');
    const allImages = fs.readdirSync(IMAGE_DIR);
    const draftImages = allImages.slice(0, 20).map(img => ({ image: img }));
    if (draftImages.length === 0) return 1.0;

    let scalingFactor = 1.0;
    for (let i = 0; i < 5; i++) {
        const buffer = await renderDraftGrid(draftImages);
        if (buffer.length < MAX_IMAGE_SIZE_BYTES) {
            log(`Draft scaling factor set to ${scalingFactor}`);
            return scalingFactor;
        }
        scalingFactor *= 0.9;
    }
    return scalingFactor;
}

// --- Message Handler ---
parentPort.on('message', async (task) => {
    const { type, taskName, args, correlationId } = task;

    if (type === 'init') {
        log('Worker initialized.');
        parentPort.postMessage({ type: 'init-complete' });
        return;
    }

    if (type === 'run-task') {
        try {
            let result;
            if (taskName === 'cacheMusic') {
                result = cacheMusic(...args);
            } else if (taskName === 'renderHand') {
                result = await renderHand(...args);
            } else if (taskName === 'renderDraftGrid') {
                result = await renderDraftGrid(...args);
            } else {
                throw new Error(`Unknown task: ${taskName}`);
            }
            parentPort.postMessage({ type: 'task-result', result, correlationId });
        } catch (error) {
            parentPort.postMessage({ type: 'task-result', error: error.message, correlationId });
        }
    }
});
