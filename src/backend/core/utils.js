/**
 * Utility functions for sanitization and Discord message handling.
 * These ensure that remote inputs are safe and outputs respect platform limits.
 */
const path = require('path');

/**
 * Sanitizes a string to be used as a filename or path component.
 * Prevents path traversal and removes potentially dangerous characters.
 * This is crucial for commands that interact with the local filesystem based on user input.
 * @param {string} input - The raw user input.
 * @returns {string} The sanitized string.
 */
function sanitizePath(input) {
    // Return empty string for non-string inputs to avoid processing errors
    if (typeof input !== 'string') return '';

    // Remove null bytes which can be used to bypass extension checks in some environments
    let sanitized = input.replace(/\0/g, '');

    // Normalize path separators to forward slashes for consistent processing across OSes
    sanitized = sanitized.replace(/\\/g, '/');

    // Strip out ".." to prevent navigating outside the intended music or data directories
    sanitized = sanitized.replace(/\.\./g, '');

    // Prevent absolute path escapes by removing leading slashes and Windows drive letters (e.g., C:)
    sanitized = sanitized.replace(/^[/\\]+/, '');
    sanitized = sanitized.replace(/^[a-zA-Z]:/, ''); // Remove drive letters (C:)

    // Collapse multiple consecutive slashes into one to prevent obfuscation or logic errors
    while (sanitized.includes('//')) {
        sanitized = sanitized.replace(/\/\//g, '/');
    }

    // Ensure the resulting path doesn't start or end with a slash, keeping it strictly relative
    sanitized = sanitized.replace(/^\/+/, '').replace(/\/+$/, '');

    return sanitized;
}

/**
 * Splits a long message into multiple chunks for Discord, respecting the 2000 character limit.
 * This prevents the bot from failing to send long roll results or stat blocks.
 * @param {string} text - The text to split.
 * @param {number} maxLength - Maximum length per chunk (default 1900 to be safe).
 * @returns {string[]} An array of message chunks.
 */
function splitMessage(text, maxLength = 1900) {
    // Return empty if there's no content to send
    if (!text) return [];

    // If it already fits, return as a single-element array for consistent handling
    if (text.length <= maxLength) return [text];

    const chunks = [];
    let currentPos = 0;

    // Iterate through the text, slicing it into chunks that fit the limit
    while (currentPos < text.length) {
        let endPos = currentPos + maxLength;

        // Attempt to split at a newline character within the limit to preserve readability
        if (endPos < text.length) {
            const lastNewline = text.lastIndexOf('\n', endPos);
            // Only split at newline if it's forward of our current starting position
            if (lastNewline > currentPos) {
                endPos = lastNewline;
            }
        }

        // Add the slice to our chunks and advance the pointer
        chunks.push(text.substring(currentPos, endPos).trim());
        currentPos = endPos;
    }
    return chunks;
}

module.exports = {
    sanitizePath,
    splitMessage
};
