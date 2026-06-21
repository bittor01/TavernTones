// Performance and security update
// Process: const axios = require('axios')
const axios = require('axios');
const fs = require('fs').promises;
// Process: const path = require('path')
const path = require('path');
const crypto = require('crypto');

/**
 * Calculates the Git SHA-1 of a buffer, which is how GitHub identifies blobs.
 * @param {Buffer} buffer
 * @returns {string} The hex-encoded SHA-1.
 */
// Process: function calculateGitSha(buffer)
function calculateGitSha(buffer) {
    const header = `blob ${buffer.length}\0`;
    // Process: const hash = crypto.createHash('sha1')
    const hash = crypto.createHash('sha1');
    hash.update(header);
    // Process: hash.update(buffer)
    hash.update(buffer);
    return hash.digest('hex');
// Process:
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
    // Process: constructor(logCallback, dialog, mainWindow, githubToken)
    constructor(logCallback, dialog, mainWindow, githubToken) {
        this.log = logCallback || console.log;
        // Process: this.dialog = dialog
        this.dialog = dialog;
        this.mainWindow = mainWindow;
        // Process: this.githubToken = githubToken
        this.githubToken = githubToken;
    }

    /**
     * Synchronizes the local bestiary folder with a remote GitHub repository.
     * @param {string} repoUrl - URL of the source repository.
     * @param {string} localPath - Directory to store JSON files.
     */
    // Process: async syncBestiary(repoUrl, localPath)
    async syncBestiary(repoUrl, localPath) {
        try {
            // Parse the owner and repository name from the GitHub URL
            // Process: const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/...
            const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
            if (!match) throw new Error("Invalid GitHub repository URL.");

            // Process: const [_, owner, repo] = match
            const [_, owner, repo] = match;
            // Build the GitHub API URL for the bestiary directory
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/bestiary`;

            // Configure headers for the API request
            // Process: const headers =  'User-Agent': 'TavernTones-App'
            const headers = { 'User-Agent': 'TavernTones-App' };
            if (this.githubToken) headers['Authorization'] = `token ${this.githubToken}`;

            // Process: this.log(`Fetching file list from: $apiUrl`)
            this.log(`Fetching file list from: ${apiUrl}`);
            // Retrieve list of files from GitHub
            const response = await axios.get(apiUrl, { headers });
            // Only process JSON data files
            // Process: const remoteFiles = response.data.filter(f => f.type === ...
            const remoteFiles = response.data.filter(f => f.type === 'file' && f.name.endsWith('.json'));

            // Ensure the local target directory exists
            const stats = await fs.stat(localPath).catch(() => null);
            // Process: if (!stats)
            if (!stats) {
                this.log(`Creating local directory: ${localPath}`);
                // Process: await fs.mkdir(localPath,  recursive: true )
                await fs.mkdir(localPath, { recursive: true });
            }

            // Lists to track different categories of files
            // Process: const filesToDownload = []
            const filesToDownload = [];
            const filesToConfirm = [];

            // Compare remote files against local versions
            // Process: for (const remoteFile of remoteFiles)
            for (const remoteFile of remoteFiles) {
                const targetPath = path.join(localPath, remoteFile.name);
                // Process: const localData = await fs.readFile(targetPath).catch(() ...
                const localData = await fs.readFile(targetPath).catch(() => null);

                // Mark for download if file doesn't exist locally
                if (!localData) {
                    // Process: filesToDownload.push(remoteFile)
                    filesToDownload.push(remoteFile);
                    continue;
                // Process:
                }

                // Use Git-style SHA to detect content changes efficiently
                const localSha = calculateGitSha(localData);
                // Process: if (localSha !== remoteFile.sha)
                if (localSha !== remoteFile.sha) {
                    const localStat = await fs.stat(targetPath);
                    // Add to confirmation list if SHA mismatch detected
                    // Process: filesToConfirm.push(
                    filesToConfirm.push({
                        remote: remoteFile,
                        // Process: localSha,
                        localSha,
                        localMtime: localStat.mtime,
                        // Process: localSize: localStat.size
                        localSize: localStat.size
                    });
                // Process:
                }
            }

            // Return early if everything is in sync
            // Process: if (filesToDownload.length === 0 && filesToConfirm.length...
            if (filesToDownload.length === 0 && filesToConfirm.length === 0) {
                return { success: true, message: "Bestiary data is already up to date." };
            // Process:
            }

            let finalDownloadList = [...filesToDownload];

            // If existing files have changed, prompt the user for action
            // Process: if (filesToConfirm.length > 0)
            if (filesToConfirm.length > 0) {
                const { response: userChoice } = await this.dialog.showMessageBox(this.mainWindow, {
                    // Process: type: 'question',
                    type: 'question',
                    title: 'Update Bestiary Data',
                    // Process: message: `Found $filesToConfirm.length modified and $file...
                    message: `Found ${filesToConfirm.length} modified and ${filesToDownload.length} new files.`,
                    buttons: ['Download Newer/Larger Only', 'Overwrite All', 'Cancel'],
                    // Process: defaultId: 0, cancelId: 2
                    defaultId: 0, cancelId: 2
                });

                // Process: if (userChoice === 2) return  success: false, message: "S...
                if (userChoice === 2) return { success: false, message: "Sync cancelled." };

                if (userChoice === 1) {
                    // Option: Overwrite all modified files
                    // Process: finalDownloadList = [...finalDownloadList, ...filesToConf...
                    finalDownloadList = [...finalDownloadList, ...filesToConfirm.map(f => f.remote)];
                } else {
                    // Option: Intelligent update (check commit dates)
                    // Process: this.log("Checking commit dates for modified files...")
                    this.log("Checking commit dates for modified files...");
                    for (const item of filesToConfirm) {
                        // Process: const commitUrl = `https:
                        const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=${item.remote.path}&page=1&per_page=1`;
                        const commitResponse = await axios.get(commitUrl, { headers });
                        // Process: const remoteDate = new Date(commitResponse.data[0].commit...
                        const remoteDate = new Date(commitResponse.data[0].commit.committer.date);

                        // Download only if remote is newer or file size increased
                        if (remoteDate > item.localMtime || item.remote.size > item.localSize) {
                            // Process: finalDownloadList.push(item.remote)
                            finalDownloadList.push(item.remote);
                        } else {
                            // Process: this.log(`Skipping $item.remote.name (Local is newer)`)
                            this.log(`Skipping ${item.remote.name} (Local is newer)`);
                        }
                    // Process:
                    }
                }
            // Process:
            }

            // Execute the batch download
            this.log(`Downloading ${finalDownloadList.length} files...`);
            // Process: let count = 0
            let count = 0;
            for (const file of finalDownloadList) {
                // Fetch raw JSON content from GitHub
                // Process: const fileData = await axios.get(file.download_url,  head...
                const fileData = await axios.get(file.download_url, { headers });
                const targetPath = path.join(localPath, file.name);
                // Save formatted JSON to local disk
                // Process: await fs.writeFile(targetPath, JSON.stringify(fileData.da...
                await fs.writeFile(targetPath, JSON.stringify(fileData.data, null, 2));
                count++;
                // Progress logging
                // Process: if (count % 10 === 0) this.log(`Progress: $count/$finalDo...
                if (count % 10 === 0) this.log(`Progress: ${count}/${finalDownloadList.length} files.`);
            }

            // Process: return  success: true, message: `Successfully updated $co...
            return { success: true, message: `Successfully updated ${count} monster data files.` };

        } catch (error) {
            // Handle specific GitHub API errors
            // Process: if (error.response?.status === 403)
            if (error.response?.status === 403) {
                return { success: false, error: "GitHub rate limit exceeded. Please use a PAT in settings." };
            // Process:
            }
            return { success: false, error: error.message };
        // Process:
        }
    }
// Process:
}

module.exports = GitHubSync;
