// Performance and security update
// Use axios for handling HTTP requests to the GitHub API
const axios = require('axios');
// Use promise-based filesystem module for cleaner asynchronous code
const fs = require('fs').promises;
// Use path module for platform-independent file path management
const path = require('path');
// Use crypto for generating hashes to compare local and remote file states
const crypto = require('crypto');

/**
 * Calculates the Git SHA-1 of a buffer, following the same algorithm GitHub uses for blobs.
 * GitHub blobs are hashed with a header: "blob [length]\0[content]".
 * @param {Buffer} buffer The file content buffer to hash.
 * @returns {string} The hex-encoded SHA-1 hash.
 */
function calculateGitSha(buffer) {
    // Construct the specific header GitHub expects
    const header = `blob ${buffer.length}\0`;
    // Create a SHA-1 hash instance
    const hash = crypto.createHash('sha1');
    // Update with the header and then the content
    hash.update(header);
    hash.update(buffer);
    // Return the final hash as a hexadecimal string
    return hash.digest('hex');
}

/**
 * GitHubSync handles the synchronization of bestiary data from a remote GitHub repository.
 * It compares local files with remote ones using Git SHAs to minimize unnecessary downloads.
 */
class GitHubSync {
    /**
     * Initializes the sync service with necessary UI hooks and authentication.
     */
    constructor(logCallback, dialog, mainWindow, githubToken) {
        // Callback to log progress messages back to the renderer UI
        this.log = logCallback || console.log;
        // Electron dialog module for showing prompts to the user
        this.dialog = dialog;
        // Reference to the main BrowserWindow for parented dialogs
        this.mainWindow = mainWindow;
        // Optional GitHub Personal Access Token to increase API rate limits
        this.githubToken = githubToken;
    }

    /**
     * Synchronizes the bestiary JSON files from the specified repository to a local folder.
     * @param {string} repoUrl URL of the 5eTools source repository.
     * @param {string} localPath Directory where the data should be saved locally.
     * @returns {Promise<object>} Result object with success status and a message.
     */
    async syncBestiary(repoUrl, localPath) {
        try {
            // Extract owner and repo names from the provided GitHub URL using regex
            // Supports formats like https://github.com/owner/repo
            const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
            if (!match) {
                throw new Error("Invalid GitHub repository URL.");
            }
            const [_, owner, repo] = match;
            // Construct the API endpoint to list the contents of the bestiary data directory
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/bestiary`;

            // Set up common headers for GitHub API requests
            const headers = { 'User-Agent': 'TavernTones-App' };
            // Include authentication if a token is provided by the user
            if (this.githubToken) {
                headers['Authorization'] = `token ${this.githubToken}`;
            }

            this.log(`Fetching file list from: ${apiUrl}`);
            // Fetch the list of files in the remote bestiary directory
            const response = await axios.get(apiUrl, { headers });
            // Filter the response to include only JSON files
            const remoteFiles = response.data.filter(f => f.type === 'file' && f.name.endsWith('.json'));

            // Ensure the destination directory exists locally
            const stats = await fs.stat(localPath).catch(() => null);
            if (!stats) {
                this.log(`Creating local directory: ${localPath}`);
                // Create directory recursively (including parents) if missing
                await fs.mkdir(localPath, { recursive: true });
            }

            // Track which files need downloading or further comparison
            const filesToDownload = [];
            const filesToConfirm = [];

            // Iterate through every file found in the remote repository
            for (const remoteFile of remoteFiles) {
                const targetPath = path.join(localPath, remoteFile.name);
                // Attempt to read the corresponding local file
                const localData = await fs.readFile(targetPath).catch(() => null);

                // If local file doesn't exist, mark it for immediate download
                if (!localData) {
                    filesToDownload.push(remoteFile);
                    continue;
                }

                // If it exists, calculate its SHA to see if it matches the remote version
                const localSha = calculateGitSha(localData);
                if (localSha !== remoteFile.sha) {
                    // If SHAs differ, the file has been updated either locally or remotely
                    const localStat = await fs.stat(targetPath);

                    // Collect metadata to help decide whether to overwrite during the confirmation step
                    filesToConfirm.push({
                        remote: remoteFile,
                        localSha,
                        localMtime: localStat.mtime,
                        localSize: localStat.size
                    });
                }
            }

            // Exit early if everything is already in sync
            if (filesToDownload.length === 0 && filesToConfirm.length === 0) {
                return { success: true, message: "Bestiary data is already up to date." };
            }

            // Determine the final list of files that will be downloaded
            let finalDownloadList = [...filesToDownload];

            // If some files differ, ask the user how they want to handle the conflicts
            if (filesToConfirm.length > 0) {
                const { response: userChoice } = await this.dialog.showMessageBox(this.mainWindow, {
                    type: 'question',
                    title: 'Update Bestiary Data',
                    message: `Found ${filesToConfirm.length} modified files and ${filesToDownload.length} new files. How would you like to proceed?`,
                    buttons: ['Download Newer/Larger Only', 'Overwrite All', 'Cancel'],
                    defaultId: 0,
                    cancelId: 2
                });

                // User clicked 'Cancel' - abort the sync process
                if (userChoice === 2) return { success: false, message: "Sync cancelled by user." };

                // User clicked 'Overwrite All' - queue all modified files for download
                if (userChoice === 1) {
                    finalDownloadList = [...finalDownloadList, ...filesToConfirm.map(f => f.remote)];
                }
                // User clicked 'Download Newer/Larger Only' - perform detailed commit date check
                else {
                    this.log("Fetching commit dates for modified files...");
                    for (const item of filesToConfirm) {
                        // Get the most recent commit for this specific file to find its remote update date
                        const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=${item.remote.path}&page=1&per_page=1`;
                        const commitResponse = await axios.get(commitUrl, { headers });
                        const remoteDate = new Date(commitResponse.data[0].commit.committer.date);

                        // Download only if the remote version is newer than the local file's modification date
                        // Or if the remote file size is larger (implying more data)
                        if (remoteDate > item.localMtime || item.remote.size > item.localSize) {
                            finalDownloadList.push(item.remote);
                        } else {
                            this.log(`Skipping ${item.remote.name} (Local is newer or larger)`);
                        }
                    }
                }
            }

            // Begin the actual download and write process
            this.log(`Downloading ${finalDownloadList.length} files...`);
            let count = 0;
            for (const fileToDownload of finalDownloadList) {
                // Fetch the raw content of the file from GitHub's download URL
                const fileData = await axios.get(fileToDownload.download_url, { headers });
                const targetPath = path.join(localPath, fileToDownload.name);
                // Save the data locally with pretty-printing for human readability
                await fs.writeFile(targetPath, JSON.stringify(fileData.data, null, 2));
                count++;
                // Log progress every 10 files to keep the user informed without spamming
                if (count % 10 === 0) this.log(`Downloaded ${count}/${finalDownloadList.length} files...`);
            }

            return { success: true, message: `Successfully updated ${count} files.` };

        } catch (error) {
            // Special handling for GitHub rate limit errors (HTTP 403)
            if (error.response && error.response.status === 403) {
                this.log("GitHub API Error: 403 Forbidden. This is likely a rate limit issue.");
                return { success: false, error: "GitHub rate limit exceeded. Please provide a Personal Access Token in settings to continue." };
            }
            // Log and return any other general errors
            const errorMessage = `Error syncing Bestiary data: ${error.message}`;
            this.log(errorMessage);
            return { success: false, error: error.message };
        }
    }
}

// Export the class for use in main.js
module.exports = GitHubSync;
