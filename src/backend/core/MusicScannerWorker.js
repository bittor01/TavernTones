/**
 * Music Scanner Worker
 * This background thread performs a recursive scan of the local music directory.
 * It builds a hierarchical tree structure representing the library to avoid
 * blocking the main Electron thread during disk I/O.
 */
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');

/**
 * Recursively scans a directory for files matching specified extensions.
 * @param {string} dir - The directory to scan.
 * @param {string[]} extensions - List of extensions (e.g. ['.mp3']).
 * @returns {object|null} A library node object with children, or null if invalid.
 */
function scanDirectory(dir, extensions) {
    // Retrieve filesystem metadata for the directory
    const stats = fs.statSync(dir);
    // Ignore items that are not directories
    if (!stats.isDirectory()) return null;

    // Initialize node for current directory
    const node = {
        name: path.basename(dir),
        path: dir,
        type: 'directory',
        children: []
    };

    // List all items within the directory
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
            // Get item metadata
            const fileStats = fs.statSync(fullPath);
            if (fileStats.isDirectory()) {
                // Recursively scan subdirectories
                const childDir = scanDirectory(fullPath, extensions);
                // Only include subdirectories that contain at least one valid audio file
                if (childDir && childDir.children.length > 0) {
                    node.children.push(childDir);
                }
            } else {
                // Process files
                const ext = path.extname(file).toLowerCase();
                // Check if file extension is supported
                if (extensions.includes(ext)) {
                    // Add file node with metadata for diffing
                    node.children.push({
                        name: file,
                        path: fullPath,
                        type: 'file',
                        size: fileStats.size,
                        mtime: fileStats.mtimeMs
                    });
                }
            }
        } catch (e) {
            // Silently skip items with permission errors or inaccessible paths
        }
    }

    // Sort items: directories first, then alphabetical by name
    node.children.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
    });
    return node;
}

// Extract scan parameters from worker initialization data
const { musicFolder, extensions } = workerData;
try {
    // Verify that the root music folder exists before scanning
    if (fs.existsSync(musicFolder)) {
        // Execute the recursive scan
        const library = scanDirectory(musicFolder, extensions);
        // Dispatch the completed tree back to the main process
        parentPort.postMessage({ success: true, library });
    } else {
        // Report error if folder is missing
        parentPort.postMessage({ success: false, error: 'Music folder does not exist' });
    }
} catch (error) {
    // Catch and report any unhandled exceptions during scan
    parentPort.postMessage({ success: false, error: error.message });
}
