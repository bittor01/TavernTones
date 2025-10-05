/**
 * @file Provides text manipulation utilities, such as splitting long strings.
 * @author jules
 */

/**
 * The default maximum length for a text chunk, typically for Discord embed fields.
 * @type {number}
 */
const MAX_LENGTH = 1024;

/**
 * Splits a long string into an array of smaller chunks, each within a maximum length.
 * This function is crucial for fitting long descriptions into Discord embed fields, which have
 * a character limit (1024). It intelligently splits text by newlines first, then by spaces
 * to avoid breaking words. If a single paragraph is too long, it's split by words.
 *
 * @param {string} text The text to split.
 * @param {number} [maxLength=MAX_LENGTH] The maximum length allowed for each chunk.
 * @returns {string[]} An array of text chunks, each no longer than `maxLength`.
 */
function splitText(text, maxLength = MAX_LENGTH) {
    if (typeof text !== 'string' || text.length <= maxLength) {
        return [text];
    }

    const chunks = [];
    let currentChunk = "";

    // Split the text into paragraphs to respect them as natural breaking points.
    const paragraphs = text.split('\n');

    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];

        // If a single paragraph is longer than the max length, it must be split aggressively.
        if (paragraph.length > maxLength) {
            // First, push whatever was in the current chunk before this oversized paragraph.
            if (currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
            }

            // Split the oversized paragraph by words and build new chunks.
            const words = paragraph.split(' ');
            let longParagraphChunk = "";
            for (const word of words) {
                if (longParagraphChunk.length + word.length + 1 > maxLength) {
                    chunks.push(longParagraphChunk.trim());
                    longParagraphChunk = word;
                } else {
                    longParagraphChunk += (longParagraphChunk ? " " : "") + word;
                }
            }
            // Push the remainder of the long paragraph.
            if (longParagraphChunk.length > 0) {
                chunks.push(longParagraphChunk.trim());
            }
        }
        // If the next paragraph fits into the current chunk, add it.
        else if (currentChunk.length + paragraph.length + 1 <= maxLength) {
            currentChunk += (currentChunk ? "\n" : "") + paragraph;
        }
        // Otherwise, the current chunk is full. Push it and start a new one.
        else {
            chunks.push(currentChunk.trim());
            currentChunk = paragraph;
        }
    }

    // Push the final chunk if it has any content.
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

module.exports = { splitText };