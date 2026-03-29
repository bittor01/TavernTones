const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');

/**
 * Recursively scans a directory for audio files.
 * @param {string} dir - The directory to scan.
 * @param {string[]} extensions - Array of file extensions to include.
 * @returns {object} Tree structure of the music library.
 */
function scanDirectory(dir, extensions) {
    const stats = fs.statSync(dir);
    if (!stats.isDirectory()) return null;

    const node = {
        name: path.basename(dir),
        path: dir,
        type: 'directory',
        children: []
    };

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
            const fileStats = fs.statSync(fullPath);
            if (fileStats.isDirectory()) {
                const childDir = scanDirectory(fullPath, extensions);
                if (childDir && childDir.children.length > 0) {
                    node.children.push(childDir);
                }
            } else {
                const ext = path.extname(file).toLowerCase();
                if (extensions.includes(ext)) {
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
            // Skip files with permission issues
        }
    }

    // Sort: directories first, then files alphabetically
    node.children.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
    });

    return node;
}

const { musicFolder, extensions } = workerData;

try {
    if (fs.existsSync(musicFolder)) {
        const library = scanDirectory(musicFolder, extensions);
        parentPort.postMessage({ success: true, library });
    } else {
        parentPort.postMessage({ success: false, error: 'Music folder does not exist' });
    }
} catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
}
