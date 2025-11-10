const { app } = require('electron');
const path = require('path');
const fs = require('fs-extra');

class SoundStackManager {
    constructor(logCallback) {
        this.log = logCallback || console.log;
        this.configPath = path.join(app.getPath('userData'), 'soundboard.json');
        this.stacks = [];
        this.initialize();
    }

    /**
     * @description Initializes the sound stacks, loading from config or creating a default structure.
     */
    async initialize() {
        try {
            const exists = await fs.pathExists(this.configPath);
            if (exists) {
                this.stacks = await fs.readJson(this.configPath);
                this.log('Soundboard configuration loaded successfully.');
            } else {
                // Create a default structure with 6 empty slots
                this.stacks = Array(6).fill(null).map(() => ({
                    emoji: null,
                    files: [],
                    currentIndex: 0,
                    loop: false,
                    shuffle: false,
                    isPlaying: false,
                    activeSoundId: null
                }));
                await this.saveConfiguration();
                this.log('No soundboard configuration found, created a default one.');
            }
        } catch (error) {
            this.log(`Error initializing soundboard configuration: ${error.message}`);
            // Fallback to default structure in case of file corruption
            this.stacks = Array(6).fill(null).map(() => ({
                emoji: null,
                files: [],
                currentIndex: 0,
                loop: false,
                shuffle: false,
                isPlaying: false
            }));
        }
    }

    /**
     * @description Saves the current state of all sound stacks to the JSON file.
     */
    async saveConfiguration() {
        try {
            await fs.writeJson(this.configPath, this.stacks, { spaces: 2 });
            this.log('Soundboard configuration saved.');
        } catch (error) {
            this.log(`Error saving soundboard configuration: ${error.message}`);
        }
    }

    /**
     * @description Returns the complete current configuration of all stacks.
     * @returns {Array} The array of sound stack objects.
     */
    getConfiguration() {
        return this.stacks;
    }

    // ... More methods will be added here to manage individual stacks ...
    // - addFileToStack(stackIndex, filePath)
    // - setStackEmoji(stackIndex, emoji)
    // - clearStack(stackIndex)
    // - toggleLoop(stackIndex)
    // - toggleShuffle(stackIndex)
    // - getNextSound(stackIndex)

    async addFileToStack(stackIndex, filePath) {
        if (this.stacks[stackIndex]) {
            this.stacks[stackIndex].files.push(filePath);
            await this.saveConfiguration();
            return { success: true, stack: this.stacks[stackIndex] };
        }
        return { success: false, error: 'Invalid stack index.' };
    }

    async setStackEmoji(stackIndex, emoji) {
        if (this.stacks[stackIndex]) {
            this.stacks[stackIndex].emoji = emoji;
            await this.saveConfiguration();
            return { success: true, stack: this.stacks[stackIndex] };
        }
        return { success: false, error: 'Invalid stack index.' };
    }

    async clearStack(stackIndex) {
        if (this.stacks[stackIndex]) {
            this.stacks[stackIndex] = {
                emoji: null,
                files: [],
                currentIndex: 0,
                loop: false,
                shuffle: false,
                isPlaying: false,
                activeSoundId: null
            };
            await this.saveConfiguration();
            return { success: true, stack: this.stacks[stackIndex] };
        }
        return { success: false, error: 'Invalid stack index.' };
    }

    async toggleLoop(stackIndex) {
        if (this.stacks[stackIndex]) {
            this.stacks[stackIndex].loop = !this.stacks[stackIndex].loop;
            await this.saveConfiguration();
            return { success: true, stack: this.stacks[stackIndex] };
        }
        return { success: false, error: 'Invalid stack index.' };
    }

    async toggleShuffle(stackIndex) {
        if (this.stacks[stackIndex]) {
            const stack = this.stacks[stackIndex];
            stack.shuffle = !stack.shuffle;

            if (stack.shuffle) {
                // Save the original order and shuffle the current one
                stack.originalOrder = [...stack.files];
                stack.files.sort(() => Math.random() - 0.5);
            } else {
                // Restore the original order
                if (stack.originalOrder) {
                    stack.files = [...stack.originalOrder];
                    delete stack.originalOrder;
                }
            }
            stack.currentIndex = 0; // Reset index on toggle
            await this.saveConfiguration();
            return { success: true, stack: stack };
        }
        return { success: false, error: 'Invalid stack index.' };
    }

    getNextSound(stackIndex) {
        const stack = this.stacks[stackIndex];
        if (!stack || stack.files.length === 0 || stack.currentIndex >= stack.files.length) {
            return null;
        }

        const filePath = stack.files[stack.currentIndex];

        if (!stack.shuffle) {
            stack.currentIndex++;
            if (stack.currentIndex >= stack.files.length) {
                if (stack.loop) {
                    stack.currentIndex = 0;
                } else {
                    // To stop at the end, we simply don't reset the index.
                    // The next call will fail the initial check.
                    return { filePath, stackIndex, isLastSound: true };
                }
            }
        } else {
            // If shuffle is on, we still advance the index
            stack.currentIndex++;
             if (stack.currentIndex >= stack.files.length) {
                if (stack.loop) {
                    stack.currentIndex = 0;
                    // Re-shuffle the playlist for the next loop
                    stack.files.sort(() => Math.random() - 0.5);
                }
             }
        }

        // No need to save config here as we are only changing the current index in memory

        return { filePath, stackIndex };
    }

    setStackAsPlaying(stackIndex, soundId) {
        const stack = this.stacks[stackIndex];
        if (stack) {
            stack.isPlaying = true;
            stack.activeSoundId = soundId;
            // No need to save this to disk, it's a transient state
        }
    }

    setStackAsStopped(stackIndex) {
        const stack = this.stacks[stackIndex];
        if (stack) {
            stack.isPlaying = false;
            stack.activeSoundId = null;
        }
    }

    findStackByFilePath(filePath) {
        // This needs to be more robust, as multiple stacks could have the same file.
        // For now, we'll find the first one that is currently marked as playing.
        return this.stacks.findIndex(stack => stack.isPlaying && stack.files.includes(filePath));
    }

    async savePreset(filePath) {
        try {
            await fs.writeJson(filePath, this.stacks, { spaces: 2 });
            this.log(`Soundboard preset saved to: ${filePath}`);
            return { success: true };
        } catch (error) {
            this.log(`Error saving preset: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async loadPreset(filePath) {
        try {
            this.stacks = await fs.readJson(filePath);
            await this.saveConfiguration(); // Save it as the new default config
            this.log(`Soundboard preset loaded from: ${filePath}`);
            return { success: true };
        } catch (error) {
            this.log(`Error loading preset: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = SoundStackManager;
