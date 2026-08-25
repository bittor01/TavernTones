# Potential Fixes and Improvements

This document lists potential code improvements, bug fixes, and refactoring opportunities identified during the documentation process. These have NOT been implemented to maintain code integrity as per requirements.

## Performance
- `MusicScannerWorker.js`: For very large music libraries, `fs.readdirSync` and `fs.statSync` can be slow. Using asynchronous iterators or a more optimized scanning library could improve initial load times and responsiveness during rescans.
- `AudioMixerWorker.js`: The mixing loop uses `writeInt16LE` in a loop, which can be less efficient than manipulating a `TypedArray` directly. Using a `Float32Array` for mixing and then a single conversion to `Int16Array` for the output might be more performant and provide better audio precision.

## Security
- (None identified yet)

## Refactoring
- `config.js`: The encryption key for `electron-store` is hardcoded as `'a-bad-secret-key-for-taverntones'`. While `safeStorage` is used for tokens, the rest of the config is obfuscated with this static key, which isn't very secure if someone has access to the source code.
- `InitiativeTracker.js`: The HP formula parser for mobs is a custom, limited implementation. Using a dedicated math expression library or the existing `DiceRoller` for all HP calculations would be more robust and consistent.
- `BackendAudioPlayer.js`: The `getMusicFiles` method uses `fs.readdirSync` and `fs.statSync` synchronously, which could block the main thread for very large music libraries. This should be moved to a worker or made asynchronous.
- `BackendAudioPlayer.js`: The ducking logic is quite simple (fixed multiplier). Allowing user-configurable ducking levels and fade in/out durations would improve the professional feel of the audio.
- `ThreadedAudioMixer.js`: The `_read` implementation requests data from the worker but doesn't handle backpressure particularly aggressively. If the consumer (Discord) stops reading, the worker might continue to be requested until the `BUFFER_TARGET` is reached, which is fine, but it relies on `isReading` to resume.
- `GitHubSync.js`: The `syncBestiary` method fetches commit dates in a loop when 'Download Newer/Larger Only' is selected. This can quickly exhaust GitHub API rate limits if many files are modified, especially without a Personal Access Token. Batching or using a different API endpoint for comparison might be better.
- `5eParser.js`: The `categorySources` object defines many categories like 'spells' and 'items', but the `_loadCategoryData` method explicitly blocks everything except 'bestiary'. The unused categories and their configurations should either be implemented or removed to reduce confusion.
- `CommandHandler.js`: `getAllFiles` is defined multiple times inside different methods. It should be extracted to a utility function or a class method to avoid redundancy and improve maintainability.
- `CommandHandler.js`: The hierarchy search in `findMusic` is quite long and could be split into smaller, more focused methods for clarity.
- `DropdownHandler.js`: The logic for calculating `pageSize` and `reservedSlots` could be slightly more robust by explicitly checking if adding pagination controls *causes* the need for more pagination (edge case where adding "Next" pushes an item to a new page).

## Bug Fixes
- `CommandHandler.js`: In `!ro` command, `iterationCount` is checked to be `<=` 999, which is good for safety, but the delay between rolls is only 100ms. Large counts might still hit Discord rate limits or take a very long time to complete in a single thread.
- `5eEmbedFormatter.js`: `formatMonster` is currently just a placeholder and doesn't display any of the monster's actual stats (AC, HP, Abilities, Actions).
