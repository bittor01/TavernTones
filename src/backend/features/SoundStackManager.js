const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

class SoundStackManager {
    constructor(logCallback) {
        this.log = logCallback || console.log;
        this.autosavePath = path.join(app.getPath('userData'), 'soundboard.json');
        this.stacks = {}; // { id: { emoji: '▶️', playlist: [], currentIndex: 0, loop: false, shuffle: false, originalPlaylist: [] } }
        this.load();
    }

    async load() {
        try {
            const data = await fs.readJson(this.autosavePath);
            this.stacks = data.stacks || {};
            this.log('[SoundStackManager] Soundboard state loaded successfully.');
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.log('[SoundStackManager] No existing soundboard state found. Initializing with empty state.');
                this.stacks = {};
                // Create a default empty 2x3 grid
                for (let i = 0; i < 6; i++) {
                    this.addStack();
                }
            } else {
                this.log(`[SoundStackManager] Error loading soundboard state: ${error.message}`);
            }
        }
    }

    async save() {
        try {
            await fs.writeJson(this.autosavePath, { stacks: this.stacks }, { spaces: 2 });
            this.log('[SoundStackManager] Soundboard state saved.');
        } catch (error) {
            this.log(`[SoundStackManager] Error saving soundboard state: ${error.message}`);
        }
    }

    getState() {
        return this.stacks;
    }

    addStack() {
        const id = `stack-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        this.stacks[id] = {
            id,
            emoji: '➕',
            playlist: [],
            originalPlaylist: [],
            currentIndex: 0,
            loop: false,
            shuffle: false,
            isPlaying: false
        };
        this.save();
        this.log(`[SoundStackManager] Added new empty stack with ID: ${id}`);
        return this.stacks[id];
    }

    updateStack(stackId, properties) {
        if (!this.stacks[stackId]) {
            this.log(`[SoundStackManager] Update failed: Stack with ID ${stackId} not found.`);
            return null;
        }

        const stack = this.stacks[stackId];
        const oldShuffleState = stack.shuffle;

        // Update properties
        Object.assign(stack, properties);

        // Handle shuffle logic
        if (properties.shuffle === true && oldShuffleState === false) {
            // Shuffle was just turned ON
            stack.originalPlaylist = [...stack.playlist]; // Save original order
            stack.playlist = this.shuffleArray([...stack.playlist]);
            stack.currentIndex = 0;
        } else if (properties.shuffle === false && oldShuffleState === true) {
            // Shuffle was just turned OFF
            stack.playlist = [...stack.originalPlaylist]; // Restore original order
            stack.currentIndex = 0;
        }

        this.save();
        this.log(`[SoundStackManager] Updated stack ${stackId}.`);
        return stack;
    }

    addSoundToStack(stackId, filePath) {
        if (!this.stacks[stackId]) {
            this.log(`[SoundStackManager] Add sound failed: Stack with ID ${stackId} not found.`);
            return null;
        }
        const stack = this.stacks[stackId];
        stack.playlist.push(filePath);
        stack.originalPlaylist.push(filePath); // Keep original in sync
        this.save();
        this.log(`[SoundStackManager] Added sound '${filePath}' to stack ${stackId}.`);
        return stack;
    }

    getNextSound(stackId) {
        if (!this.stacks[stackId]) return null;

        const stack = this.stacks[stackId];
        if (stack.playlist.length === 0) return null;

        let soundPath = stack.playlist[stack.currentIndex];

        // Advance index
        stack.currentIndex++;

        // Handle end of playlist
        if (stack.currentIndex >= stack.playlist.length) {
            if (stack.loop) {
                stack.currentIndex = 0;
                // If shuffle is also on, re-shuffle the playlist for the next loop
                if (stack.shuffle) {
                    stack.playlist = this.shuffleArray([...stack.originalPlaylist]);
                }
            } else {
                // Not looping, so we're at the end. Reset for next manual play.
                stack.currentIndex = 0;
            }
        }

        this.save();
        return soundPath;
    }

    clearStack(stackId) {
        if (!this.stacks[stackId]) return null;
        const stack = this.stacks[stackId];
        stack.playlist = [];
        stack.originalPlaylist = [];
        stack.currentIndex = 0;
        stack.emoji = '➕';
        // Reset other properties to default if desired
        stack.loop = false;
        stack.shuffle = false;
        stack.isPlaying = false;
        this.save();
        this.log(`[SoundStackManager] Cleared stack ${stackId}.`);
        return stack;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    async loadPreset(filePath) {
        try {
            const data = await fs.readJson(filePath);
            if (data && data.stacks) {
                this.stacks = data.stacks;
                this.save(); // Save this loaded preset as the new autosave state
                this.log(`[SoundStackManager] Preset loaded from ${filePath}`);
                return this.stacks;
            }
            throw new Error('Invalid preset file format.');
        } catch (error) {
            this.log(`[SoundStackManager] Error loading preset: ${error.message}`);
            return null;
        }
    }

    async savePreset(filePath) {
        try {
            // Ensure the directory exists
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeJson(filePath, { stacks: this.stacks }, { spaces: 2 });
            this.log(`[SoundStackManager] Preset saved to ${filePath}`);
            return true;
        } catch (error) {
            this.log(`[SoundStackManager] Error saving preset: ${error.message}`);
            return false;
        }
    }
}

module.exports = SoundStackManager;
