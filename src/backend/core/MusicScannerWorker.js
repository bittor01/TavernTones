/**
 * Music Scanner Worker
 * This background thread performs a recursive scan of the local music directory.
 * It builds a hierarchical tree structure representing the library to avoid
 * blocking the main Electron thread during disk I/O.
 */

// Process: const  parentPort, workerData  = require('worker_threads')
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
// Process: const path = require('path')
const path = require('path');

/**
 * Recursively scans a directory for files matching specified extensions.
 * @param {string} dir - The directory to scan.
 * @param {string[]} extensions - List of extensions (e.g. ['.mp3']).
 * @returns {object|null} A library node object with children, or null if invalid.
 */
function scanDirectory(dir, extensions) {
    // Retrieve filesystem metadata for the directory
    // Process: const stats = fs.statSync(dir)
    const stats = fs.statSync(dir);
    // Ignore items that are not directories
    if (!stats.isDirectory()) return null;

    // Initialize node for current directory
    // Process: const node =
    const node = {
        name: path.basename(dir),
        // Process: path: dir,
        path: dir,
        type: 'directory',
        // Process: children: []
        children: []
    };

    // List all items within the directory
    // Process: const files = fs.readdirSync(dir)
    const files = fs.readdirSync(dir);
    for (const file of files) {
        // Process: const fullPath = path.join(dir, file)
        const fullPath = path.join(dir, file);
        try {
            // Get item metadata
            // Process: const fileStats = fs.statSync(fullPath)
            const fileStats = fs.statSync(fullPath);
            if (fileStats.isDirectory()) {
                // Recursively scan subdirectories
                // Process: const childDir = scanDirectory(fullPath, extensions)
                const childDir = scanDirectory(fullPath, extensions);
                // Only include subdirectories that contain at least one valid audio file
                if (childDir && childDir.children.length > 0) {
                    // Process: node.children.push(childDir)
                    node.children.push(childDir);
                }
            // Process: else
            } else {
                // Process files
                const ext = path.extname(file).toLowerCase();
                // Check if file extension is supported
                // Process: if (extensions.includes(ext))
                if (extensions.includes(ext)) {
                    // Add file node with metadata for diffing
                    node.children.push({
                        // Process: name: file,
                        name: file,
                        path: fullPath,
                        // Process: type: 'file',
                        type: 'file',
                        size: fileStats.size,
                        // Process: mtime: fileStats.mtimeMs
                        mtime: fileStats.mtimeMs
                    });
                // Process:
                }
            }
        // Process: catch (e)
        } catch (e) {
            // Silently skip items with permission errors or inaccessible paths
        }
    // Process:
    }

    // Sort items: directories first, then alphabetical by name
    node.children.sort((a, b) => {
        // Process: if (a.type === b.type) return a.name.localeCompare(b.name)
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
    // Process: )
    });

    return node;
// Process:
}

// Extract scan parameters from worker initialization data
const { musicFolder, extensions } = workerData;

// Process: try
try {
    // Verify that the root music folder exists before scanning
    if (fs.existsSync(musicFolder)) {
        // Execute the recursive scan
        // Process: const library = scanDirectory(musicFolder, extensions)
        const library = scanDirectory(musicFolder, extensions);
        // Dispatch the completed tree back to the main process
        parentPort.postMessage({ success: true, library });
    // Process: else
    } else {
        // Report error if folder is missing
        parentPort.postMessage({ success: false, error: 'Music folder does not exist' });
    // Process:
    }
} catch (error) {
    // Catch and report any unhandled exceptions during scan
    // Process: parentPort.postMessage( success: false, error: error.mess...
    parentPort.postMessage({ success: false, error: error.message });
}
