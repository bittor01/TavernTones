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

class GitHubSync {
    constructor(logCallback, dialog, mainWindow) {
        this.log = logCallback || console.log;
        this.dialog = dialog;
        this.mainWindow = mainWindow;
    }

    async syncBestiary(repoUrl, localPath) {
        try {
            // Extract owner and repo from URL (e.g. https://github.com/5etools-mirror-3/5etools-src)
            const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
            if (!match) {
                throw new Error("Invalid GitHub repository URL.");
            }
            const [_, owner, repo] = match;
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/bestiary`;
            const headers = { 'User-Agent': 'TavernTones-App' };

            this.log(`Fetching file list from: ${apiUrl}`);
            const response = await axios.get(apiUrl, { headers });
            const remoteFiles = response.data.filter(f => f.type === 'file' && f.name.endsWith('.json'));

            if (!await fs.stat(localPath).catch(() => null)) {
                await fs.mkdir(localPath, { recursive: true });
            }

            const filesToDownload = [];
            const filesToConfirm = [];

            for (const remoteFile of remoteFiles) {
                const targetPath = path.join(localPath, remoteFile.name);
                const localData = await fs.readFile(targetPath).catch(() => null);

                if (!localData) {
                    filesToDownload.push(remoteFile);
                    continue;
                }

                const localSha = calculateGitSha(localData);
                if (localSha !== remoteFile.sha) {
                    // Difference found.
                    const localStat = await fs.stat(targetPath);

                    // We need remote last commit date to compare properly.
                    // To avoid hitting rate limits, we'll collect these for a separate confirmation step.
                    filesToConfirm.push({
                        remote: remoteFile,
                        localSha,
                        localMtime: localStat.mtime,
                        localSize: localStat.size
                    });
                }
            }

            if (filesToDownload.length === 0 && filesToConfirm.length === 0) {
                return { success: true, message: "Bestiary data is already up to date." };
            }

            // If we have diffs, we might want to fetch remote dates for THEM specifically.
            // But let's simplify: offer a choice based on size and the fact they are different.

            let finalDownloadList = [...filesToDownload];

            if (filesToConfirm.length > 0) {
                const { response: userChoice } = await this.dialog.showMessageBox(this.mainWindow, {
                    type: 'question',
                    title: 'Update Bestiary Data',
                    message: `Found ${filesToConfirm.length} modified files and ${filesToDownload.length} new files. How would you like to proceed?`,
                    buttons: ['Download Newer/Larger Only', 'Overwrite All', 'Cancel'],
                    defaultId: 0,
                    cancelId: 2
                });

                if (userChoice === 2) return { success: false, message: "Sync cancelled by user." };

                if (userChoice === 1) {
                    // Overwrite All
                    finalDownloadList = [...finalDownloadList, ...filesToConfirm.map(f => f.remote)];
                } else {
                    // Download Newer/Larger Only
                    this.log("Fetching commit dates for modified files...");
                    for (const item of filesToConfirm) {
                        const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=${item.remote.path}&page=1&per_page=1`;
                        const commitResponse = await axios.get(commitUrl, { headers });
                        const remoteDate = new Date(commitResponse.data[0].commit.committer.date);

                        if (remoteDate > item.localMtime || item.remote.size > item.localSize) {
                            finalDownloadList.push(item.remote);
                        } else {
                            this.log(`Skipping ${item.remote.name} (Local is newer or larger)`);
                        }
                    }
                }
            }

            // Perform downloads
            this.log(`Downloading ${finalDownloadList.length} files...`);
            let count = 0;
            for (const fileToDownload of finalDownloadList) {
                const fileData = await axios.get(fileToDownload.download_url, { headers });
                const targetPath = path.join(localPath, fileToDownload.name);
                await fs.writeFile(targetPath, JSON.stringify(fileData.data, null, 2));
                count++;
                if (count % 10 === 0) this.log(`Downloaded ${count}/${finalDownloadList.length} files...`);
            }

            return { success: true, message: `Successfully updated ${count} files.` };

        } catch (error) {
            this.log(`Error syncing Bestiary data: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = GitHubSync;
