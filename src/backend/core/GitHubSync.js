// Performance and security update
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Calculates the Git SHA-1 of a buffer, which is how GitHub identifies blobs.
 * @param {Buffer} buffer
 * @returns {string} The hex-encoded SHA-1.
 */
function calculateGitSha(buffer) {
    const header = `blob ${buffer.length}\0`;
    const hash = crypto.createHash('sha1');
    hash.update(header);
    hash.update(buffer);
    return hash.digest('hex');
}

/**
 * Manages synchronization of D&D 5e Bestiary data from a GitHub repository.
 * Detects changes and allows the user to update their local monster files.
 */
class GitHubSync {
    /**
     * Initializes the synchronization service.
     * @param {function} logCallback - Logger for progress updates.
     * @param {object} dialog - Electron dialog module for user prompts.
     * @param {BrowserWindow} mainWindow - Reference to the main window.
     * @param {string} githubToken - Optional Personal Access Token for higher rate limits.
     */
    constructor(logCallback, dialog, mainWindow, githubToken) {
        this.log = logCallback || console.log;
        this.dialog = dialog;
        this.mainWindow = mainWindow;
        this.githubToken = githubToken;
    }

    /**
     * Synchronizes the local bestiary folder with a remote GitHub repository.
     * @param {string} repoUrl - URL of the source repository.
     * @param {string} localPath - Directory to store JSON files.
     */
    async syncBestiary(repoUrl, localPath) {
        try {
            // Parse the owner and repository name from the GitHub URL
            const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
            if (!match) throw new Error("Invalid GitHub repository URL.");
            const [_, owner, repo] = match;
            // Build the GitHub API URL for the bestiary directory
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/bestiary`;

            // Configure headers for the API request
            const headers = { 'User-Agent': 'TavernTones-App' };
            if (this.githubToken) headers['Authorization'] = `token ${this.githubToken}`;
            this.log(`Fetching file list from: ${apiUrl}`);
            // Retrieve list of files from GitHub
            const response = await axios.get(apiUrl, { headers });
            // Only process JSON data files
            const remoteFiles = response.data.filter(f => f.type === 'file' && f.name.endsWith('.json'));

            // Ensure the local target directory exists
            const stats = await fs.stat(localPath).catch(() => null);
            if (!stats) {
                this.log(`Creating local directory: ${localPath}`);
                await fs.mkdir(localPath, { recursive: true });
            }

            // Lists to track different categories of files
            const filesToDownload = [];
            const filesToConfirm = [];

            // Compare remote files against local versions
            for (const remoteFile of remoteFiles) {
                const targetPath = path.join(localPath, remoteFile.name);
                const localData = await fs.readFile(targetPath).catch(() => null);

                // Mark for download if file doesn't exist locally
                if (!localData) {
                    filesToDownload.push(remoteFile);
                    continue;
                }

                // Use Git-style SHA to detect content changes efficiently
                const localSha = calculateGitSha(localData);
                if (localSha !== remoteFile.sha) {
                    const localStat = await fs.stat(targetPath);
                    // Add to confirmation list if SHA mismatch detected
                    filesToConfirm.push({
                        remote: remoteFile,
                        localSha,
                        localMtime: localStat.mtime,
                        localSize: localStat.size
                    });
                }
            }

            // Return early if everything is in sync
            if (filesToDownload.length === 0 && filesToConfirm.length === 0) {
                return { success: true, message: "Bestiary data is already up to date." };
            }
            let finalDownloadList = [...filesToDownload];

            // If existing files have changed, prompt the user for action
            if (filesToConfirm.length > 0) {
                const { response: userChoice } = await this.dialog.showMessageBox(this.mainWindow, {
                    type: 'question',
                    title: 'Update Bestiary Data',
                    message: `Found ${filesToConfirm.length} modified and ${filesToDownload.length} new files.`,
                    buttons: ['Download Newer/Larger Only', 'Overwrite All', 'Cancel'],
                    defaultId: 0, cancelId: 2
                });
                if (userChoice === 2) return { success: false, message: "Sync cancelled." };
                if (userChoice === 1) {
                    // Option: Overwrite all modified files
                    finalDownloadList = [...finalDownloadList, ...filesToConfirm.map(f => f.remote)];
                } else {
                    // Option: Intelligent update (check commit dates)
                    this.log("Checking commit dates for modified files...");
                    for (const item of filesToConfirm) {
                        const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=${item.remote.path}&page=1&per_page=1`;
                        const commitResponse = await axios.get(commitUrl, { headers });
                        const remoteDate = new Date(commitResponse.data[0].commit.committer.date);

                        // Download only if remote is newer or file size increased
                        if (remoteDate > item.localMtime || item.remote.size > item.localSize) {
                            finalDownloadList.push(item.remote);
                        } else {
                            this.log(`Skipping ${item.remote.name} (Local is newer)`);
                        }
                    }
                }
            }

            // Execute the batch download
            this.log(`Downloading ${finalDownloadList.length} files...`);
            let count = 0;
            for (const file of finalDownloadList) {
                // Fetch raw JSON content from GitHub
                const fileData = await axios.get(file.download_url, { headers });
                const targetPath = path.join(localPath, file.name);
                // Save formatted JSON to local disk
                await fs.writeFile(targetPath, JSON.stringify(fileData.data, null, 2));
                count++;
                // Progress logging
                if (count % 10 === 0) this.log(`Progress: ${count}/${finalDownloadList.length} files.`);
            }
            return { success: true, message: `Successfully updated ${count} monster data files.` };
        } catch (error) {
            // Handle specific GitHub API errors
            if (error.response?.status === 403) {
                return { success: false, error: "GitHub rate limit exceeded. Please use a PAT in settings." };
            }
            return { success: false, error: error.message };
        }
    }
}
module.exports = GitHubSync;
