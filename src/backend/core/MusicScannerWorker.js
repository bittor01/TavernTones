// Import worker_threads components to communicate with the main process
const { parentPort, workerData } = require('worker_threads');
// Use synchronous filesystem methods as this runs in a dedicated worker thread
// and won't block the main Electron UI thread.
const fs = require('fs');
// Import path module for cross-platform file path manipulation
const path = require('path');

/**
 * Recursively scans a directory for audio files and builds a tree structure.
 * @param {string} dir - The absolute path of the directory to scan.
 * @param {string[]} extensions - Array of file extensions to include (e.g. ['.mp3', '.wav']).
 * @returns {object|null} A node representing the directory and its contents, or null if not a directory.
 */
function scanDirectory(dir, extensions) {
    // Get stats to verify it's a directory
    const stats = fs.statSync(dir);
    if (!stats.isDirectory()) return null;

    // Initialize the directory node
    const node = {
        name: path.basename(dir), // The folder name (e.g. "Ambience")
        path: dir,               // Full absolute path
        type: 'directory',
        children: []             // Will hold subdirectories and files
    };

    // Read all entries within this directory
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
            const fileStats = fs.statSync(fullPath);
            // If entry is a subdirectory, recurse into it
            if (fileStats.isDirectory()) {
                const childDir = scanDirectory(fullPath, extensions);
                // Only add the subdirectory if it contains at least one valid audio file
                // This keeps the library view clean of empty folders.
                if (childDir && childDir.children.length > 0) {
                    node.children.push(childDir);
                }
            }
            // If entry is a file, check if its extension matches our allowed list
            else {
                const ext = path.extname(file).toLowerCase();
                if (extensions.includes(ext)) {
                    node.children.push({
                        name: file,       // Filename with extension
                        path: fullPath,   // Full absolute path
                        type: 'file',
                        size: fileStats.size, // File size in bytes
                        mtime: fileStats.mtimeMs // Modification timestamp for cache invalidation checks
                    });
                }
            }
        } catch (e) {
            // Silently skip files or folders that cannot be accessed due to permissions
        }
    }

    // Sort the children to ensure a consistent and user-friendly UI
    // Rules: Directories appear before files, and both groups are sorted alphabetically.
    node.children.sort((a, b) => {
        // If types are the same, compare names alphabetically
        if (a.type === b.type) return a.name.localeCompare(b.name);
        // Otherwise, prioritize directories over files
        return a.type === 'directory' ? -1 : 1;
    });

    return node;
}

// Extract the configuration passed from the main process
const { musicFolder, extensions } = workerData;

try {
    // Verify the root music folder exists before starting the scan
    if (fs.existsSync(musicFolder)) {
        // Perform the recursive scan
        const library = scanDirectory(musicFolder, extensions);
        // Send the resulting tree back to the main process
        parentPort.postMessage({ success: true, library });
    } else {
        // Inform the main process if the folder is missing
        parentPort.postMessage({ success: false, error: 'Music folder does not exist' });
    }
} catch (error) {
    // Catch and report any unexpected errors during the scanning process
    parentPort.postMessage({ success: false, error: error.message });
}
