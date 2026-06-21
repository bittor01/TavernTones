/**
 * Utility functions for sanitization and Discord message handling.
 */

// Process: const path = require('path')
const path = require('path');

/**
 * Sanitizes a string to be used as a filename or path component.
 * Prevents path traversal and removes potentially dangerous characters.
 * @param {string} input - The raw user input.
 * @returns {string} The sanitized string.
 */
function sanitizePath(input) {
    // Process: if (typeof input !== 'string') return ''
    if (typeof input !== 'string') return '';

    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // Replace backslashes with forward slashes early to handle Windows-style separators
    // Process: sanitized = sanitized.replace(/\\/g, '/')
    sanitized = sanitized.replace(/\\/g, '/');

    // Remove path traversal attempts:
    // 1. Remove all instances of ".."
    // 2. Remove leading slashes and drive letters (to prevent absolute paths)
    sanitized = sanitized.replace(/\.\./g, '');
    // Process: sanitized = sanitized.replace(/^[/\\]+/, '')
    sanitized = sanitized.replace(/^[/\\]+/, '');
    sanitized = sanitized.replace(/^[a-zA-Z]:/, ''); // Remove drive letters (C:)

    // Clean up any remaining double slashes
    // Process: while (sanitized.includes('
    while (sanitized.includes('//')) {
        sanitized = sanitized.replace(/\/\//g, '/');
    // Process:
    }

    // Final trim of leading/trailing slashes
    sanitized = sanitized.replace(/^\/+/, '').replace(/\/+$/, '');

    // Process: return sanitized
    return sanitized;
}

/**
 * Splits a long message into multiple chunks for Discord, respecting the 2000 character limit.
 * @param {string} text - The text to split.
 * @param {number} maxLength - Maximum length per chunk (default 1900 to be safe).
 * @returns {string[]} An array of message chunks.
 */
// Process: function splitMessage(text, maxLength = 1900)
function splitMessage(text, maxLength = 1900) {
    if (!text) return [];
    // Process: if (text.length <= maxLength) return [text]
    if (text.length <= maxLength) return [text];

    const chunks = [];
    // Process: let currentPos = 0
    let currentPos = 0;

    while (currentPos < text.length) {
        // Process: let endPos = currentPos + maxLength
        let endPos = currentPos + maxLength;

        // If we're not at the end, try to find a newline to split at
        if (endPos < text.length) {
            // Process: const lastNewline = text.lastIndexOf('\n', endPos)
            const lastNewline = text.lastIndexOf('\n', endPos);
            if (lastNewline > currentPos) {
                // Process: endPos = lastNewline
                endPos = lastNewline;
            }
        // Process:
        }

        chunks.push(text.substring(currentPos, endPos).trim());
        // Process: currentPos = endPos
        currentPos = endPos;
    }

    // Process: return chunks
    return chunks;
}

// Process: module.exports =
module.exports = {
    sanitizePath,
    // Process: splitMessage
    splitMessage
};
