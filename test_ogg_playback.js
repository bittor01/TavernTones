const fs = require('fs');
const path = require('path');
const stream = require('stream');
const assert = require('assert'); // Using assert for cleaner tests

// --- Globals and Mocks ---
global.app = {
    whenReady: () => Promise.resolve(),
    on: () => {},
    quit: () => {},
    getPath: () => './', // Mock path for things like user data
};
global.BrowserWindow = class {
    constructor() {}
    loadFile() {}
    webContents = { send: () => {} };
};
global.ipcMain = {
    on: () => {},
    handle: (eventName, handler) => {
        // Store handlers to call them directly in tests
        if (!global.ipcMain.handlers) global.ipcMain.handlers = {};
        global.ipcMain.handlers[eventName] = handler;
    },
    removeAllListeners: () => {},
    handlers: {} // Initialize handlers
};
global.dialog = {
    showOpenDialog: () => Promise.resolve({ filePaths: [] }) // Default mock
};
global.shell = {
    readShortcutLink: (lnkPath) => {
        // Simple mock: if it's our dummy lnk, return the target
        if (lnkPath === path.join(process.env.DEFAULT_LOCAL_FOLDER, 'test_music_dir', 'test.lnk')) {
            return { target: path.join(process.env.DEFAULT_LOCAL_FOLDER, 'test_music_dir', 'chill', 'test.ogg') };
        }
        return { target: null }; // Mock for non-existent or other links
    }
};

// Mock environment variables (ensure DEFAULT_LOCAL_FOLDER is set in the calling environment or here)
process.env.DEFAULT_LOCAL_FOLDER = process.env.DEFAULT_LOCAL_FOLDER || path.join(__dirname, 'test_music_dir');
process.env.DISCORD_TOKEN = 'dummy_token';
process.env.VOICE_CHANNEL_ID = 'dummy_voice_channel';
process.env.BOT_ROLE_ID = 'dummy_bot_role';

// --- Require main.js ---
// We expect `main.js` to execute its setup, which includes defining functions and IPC handlers.
// We need to capture the functions we want to test.
// This is tricky because main.js also tries to log in to Discord, etc.
// We'll wrap the require in a try-catch to handle potential errors during its initial execution.

let mainJsExports = {};
try {
    // Temporarily redirect console.log from main.js if it's too noisy during setup
    const originalLog = console.log;
    // console.log = () => {}; // Uncomment to suppress main.js logs during require

    // The main.js file has side effects like Discord login.
    // We need its functions, but don't want it to fully run its course if possible.
    // For this test, we'll assume that `createReadableStream` and `findMusic`
    // are defined globally or can be extracted.
    // A better approach would be for main.js to export these functions.

    // Since main.js doesn't export, we'll have to rely on functions being available
    // in the global scope or attached to a global object if main.js does that,
    // or by re-defining parts of them here if they are self-contained enough.

    // For the purpose of this test, let's assume we can access the functions
    // after main.js has been required. The mocks should prevent crashes.
    require('./main.js'); // This will execute main.js

    // console.log = originalLog; // Restore console.log

    // Attempt to grab functions if they are exposed, e.g. if they were global
    // This is highly dependent on how main.js is structured.
    // If they are not global, this test approach will struggle.
    // For now, we'll assume `logToRenderer` is global, and other critical functions
    // like `createReadableStream` and `findMusic` are also made available or we can grab IPC handlers.

    if (typeof logToRenderer !== 'function') {
        global.logToRenderer = (message) => console.log(`[MockedLogToRenderer] ${message}`);
    }


} catch (e) {
    console.error("Error requiring main.js. Some tests might not run correctly.", e);
    if (typeof logToRenderer !== 'function') {
        global.logToRenderer = (message) => console.log(`[MockedLogToRenderer-ErrorCase] ${message}`);
    }
}

// --- Test Functions ---

async function testFindMusic() {
    console.log("\n--- Testing findMusic ---");
    const testOggPath = path.join(process.env.DEFAULT_LOCAL_FOLDER, 'chill', 'test.ogg');

    if (typeof findMusic !== 'function') {
        console.log("findMusic function not found. Skipping test.");
        return false;
    }

    try {
        // Test 1: Find with folder and song name
        let foundPath = await findMusic('chill', 'test');
        assert.strictEqual(foundPath, testOggPath, `Test 1 Failed: Expected ${testOggPath}, got ${foundPath}`);
        console.log("Test 1 Passed: findMusic('chill', 'test') found the file.");

        // Test 2: Find with folder only (random song from folder)
        foundPath = await findMusic('chill', null);
        assert.strictEqual(foundPath, testOggPath, `Test 2 Failed: Expected ${testOggPath} (or any in folder), got ${foundPath}`);
        console.log("Test 2 Passed: findMusic('chill', null) found a file (expected test.ogg as it's the only one).");

        // Test 3: Find with song name only (defaults to 'chill' folder)
        foundPath = await findMusic(null, 'test');
        assert.strictEqual(foundPath, testOggPath, `Test 3 Failed: Expected ${testOggPath}, got ${foundPath}`);
        console.log("Test 3 Passed: findMusic(null, 'test') found the file.");

        // Test 4: Non-existent song
        foundPath = await findMusic('chill', 'nonexistentsong');
        assert.strictEqual(foundPath, null, `Test 4 Failed: Expected null for non-existent song, got ${foundPath}`);
        console.log("Test 4 Passed: findMusic with non-existent song returned null.");

        // Test 5: Non-existent folder
        foundPath = await findMusic('nonexistentfolder', 'test');
        assert.strictEqual(foundPath, null, `Test 5 Failed: Expected null for non-existent folder, got ${foundPath}`);
        console.log("Test 5 Passed: findMusic with non-existent folder returned null.");
        return true;
    } catch (error) {
        console.error("Error during findMusic tests:", error);
        return false;
    }
}

async function testCreateReadableStream() {
    console.log("\n--- Testing createReadableStream ---");
    const oggFilePath = path.join(process.env.DEFAULT_LOCAL_FOLDER, 'chill', 'test.ogg');
    const nonExistentFilePath = path.join(process.env.DEFAULT_LOCAL_FOLDER, 'chill', 'nosuchfile.ogg');

    if (typeof createReadableStream !== 'function') {
        console.log("createReadableStream function not found. Skipping test.");
        return false;
    }

    try {
        // Test 1: Create stream for existing .ogg file
        const readableStream = await createReadableStream(oggFilePath);
        assert(readableStream instanceof stream.Readable, "Test 1 Failed: Did not return a readable stream for .ogg file.");
        console.log("Test 1 Passed: createReadableStream returned a readable stream for .ogg file.");

        // Test 2 (Optional): Try to read from the stream (decoding will fail for dummy ogg)
        if (readableStream) {
            let dataReceived = false;
            readableStream.on('data', (chunk) => {
                dataReceived = true;
                // console.log(`Received ${chunk.length} bytes from ogg stream.`);
            });
            await new Promise(resolve => readableStream.on('end', resolve));
            // For a dummy text file, data should still be pushed.
            assert(dataReceived, "Test 2 Failed: Stream did not emit data for dummy .ogg file.");
            console.log("Test 2 Passed: Stream for dummy .ogg file emitted data (as expected).");
        }

        // Test 3: Attempt to create stream for non-existent file
        const nullStream = await createReadableStream(nonExistentFilePath);
        assert.strictEqual(nullStream, null, "Test 3 Failed: Did not return null for non-existent file.");
        console.log("Test 3 Passed: createReadableStream returned null for non-existent file.");

        // Test 4: Attempt with unsupported file type (e.g., .txt)
        const txtFilePath = path.join(process.env.DEFAULT_LOCAL_FOLDER, 'chill', 'test.txt');
        fs.writeFileSync(txtFilePath, "hello world");
        const unsupportedStream = await createReadableStream(txtFilePath);
        assert.strictEqual(unsupportedStream, null, "Test 4 Failed: Did not return null for unsupported .txt file.");
        console.log("Test 4 Passed: createReadableStream returned null for unsupported .txt file.");
        fs.unlinkSync(txtFilePath); // Clean up

        return true;
    } catch (error) {
        console.error("Error during createReadableStream tests:", error);
        return false;
    }
}

async function testLnkResolutionConcept() {
    console.log("\n--- Testing .lnk Resolution Concept ---");
    // This test is conceptual as we're mocking shell.readShortcutLink

    if (typeof createReadableStream !== 'function' || typeof shell.readShortcutLink !== 'function') {
        console.log("createReadableStream or shell.readShortcutLink mock not found. Skipping test.");
        return false;
    }

    // Simulate a .lnk file path
    const lnkFilePath = path.join(process.env.DEFAULT_LOCAL_FOLDER, 'test_music_dir', 'test.lnk'); // Dummy path
    const expectedTargetPath = path.join(process.env.DEFAULT_LOCAL_FOLDER, 'chill', 'test.ogg');

    try {
        // Simulate shell.readShortcutLink
        const shortcut = global.shell.readShortcutLink(lnkFilePath);
        assert.strictEqual(shortcut.target, expectedTargetPath, `Test 1 Failed: Mocked shell.readShortcutLink did not return expected target. Got ${shortcut.target}`);
        console.log("Test 1 Passed: Mocked shell.readShortcutLink returned the correct target path.");

        // Test createReadableStream with the "resolved" path
        if (shortcut.target) {
            const readableStream = await createReadableStream(shortcut.target);
            assert(readableStream instanceof stream.Readable, "Test 2 Failed: Did not return a readable stream for path from mocked .lnk.");
            console.log("Test 2 Passed: createReadableStream worked with path from mocked .lnk.");
        } else {
            console.log("Test 2 Skipped: Mocked .lnk target was null.");
        }
        return true;
    } catch (error) {
        console.error("Error during .lnk resolution concept tests:", error);
        return false;
    }
}


async function testFileDialogLogic() {
    console.log("\n--- Testing File Dialog Logic (Conceptual) ---");
    const testOggPath = path.join(process.env.DEFAULT_LOCAL_FOLDER, 'chill', 'test.ogg');

    if (!global.ipcMain.handlers || typeof global.ipcMain.handlers['open-file-dialog'] !== 'function') {
        console.log("IPC handler for 'open-file-dialog' not found. Skipping test.");
        return false;
    }

    // Mock dialog.showOpenDialog to return our test .ogg file
    global.dialog.showOpenDialog = () => Promise.resolve({ filePaths: [testOggPath], canceled: false });

    try {
        const handler = global.ipcMain.handlers['open-file-dialog'];
        const resultPath = await handler();

        assert.strictEqual(resultPath, testOggPath, `Test 1 Failed: Handler returned path ${resultPath} instead of ${testOggPath}`);
        console.log("Test 1 Passed: IPC handler mock returned correct path.");

        // After the handler runs, check if pendingAudioResource and pendingFilePath were set (these are global in main.js)
        // This assumes main.js sets these variables in a way that's accessible in this scope.
        // If they are module-local, this part of the test won't work without exporting them.
        // For now, we assume they might be global or attached to an exported object.
        // Let's assume `pendingFilePath` becomes global after main.js runs.

        assert.strictEqual(global.pendingFilePath, testOggPath, `Test 2 Failed: global.pendingFilePath was not set correctly by dialog handler. Got ${global.pendingFilePath}`);
        console.log("Test 2 Passed: global.pendingFilePath was set correctly by dialog handler.");
        assert(global.pendingAudioResource instanceof stream.Readable, "Test 3 Failed: global.pendingAudioResource was not a readable stream.");
        console.log("Test 3 Passed: global.pendingAudioResource was set correctly by dialog handler.");

        // Reset for other tests
        global.pendingFilePath = null;
        global.pendingAudioResource = null;

        return true;
    } catch (error) {
        console.error("Error during file dialog logic tests:", error);
        // Reset on error too
        global.pendingFilePath = null;
        global.pendingAudioResource = null;
        return false;
    }
}


async function runTests() {
    let allTestsPassed = true;

    if (!process.env.DEFAULT_LOCAL_FOLDER || !fs.existsSync(process.env.DEFAULT_LOCAL_FOLDER)) {
        console.error(`Error: DEFAULT_LOCAL_FOLDER is not set or does not exist: ${process.env.DEFAULT_LOCAL_FOLDER}`);
        console.error("Please ensure DEFAULT_LOCAL_FOLDER is exported correctly before running the script, e.g.:");
        console.error("export DEFAULT_LOCAL_FOLDER=$(pwd)/test_music_dir");
        allTestsPassed = false;
        return;
    }
     if (!fs.existsSync(path.join(process.env.DEFAULT_LOCAL_FOLDER, 'chill', 'test.ogg'))) {
        console.error(`Error: test.ogg not found at ${path.join(process.env.DEFAULT_LOCAL_FOLDER, 'chill', 'test.ogg')}`);
        allTestsPassed = false;
        return;
    }


    allTestsPassed = await testFindMusic() && allTestsPassed;
    allTestsPassed = await testCreateReadableStream() && allTestsPassed;
    allTestsPassed = await testLnkResolutionConcept() && allTestsPassed;
    allTestsPassed = await testFileDialogLogic() && allTestsPassed;

    console.log("\n--- Test Summary ---");
    if (allTestsPassed) {
        console.log("All tests passed successfully!");
    } else {
        console.log("Some tests failed.");
    }

    // Clean up: remove the test_music_dir
    // fs.rmSync(path.join(__dirname, 'test_music_dir'), { recursive: true, force: true });
    // console.log("\nCleaned up test_music_dir.");

    console.log("Attempting to shutdown components from main.js...");
    await tryShutdown(); // Attempt graceful shutdown

    if (allTestsPassed) {
        console.log("Exiting with status 0 (success).");
        process.exit(0); // Success
    } else {
        console.log("Exiting with status 1 (failure).");
        process.exit(1); // Failure
    }
}

runTests().catch(error => {
    console.error("Error in runTests:", error);
    tryShutdown().finally(() => process.exit(1));
});

// Force exit if tests hang for too long
setTimeout(() => {
    console.log("Test script timed out. Forcing exit.");
    tryShutdown().finally(() => process.exit(1)); // Indicate failure due to timeout
}, 10000); // Reduced timeout to 10s

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  tryShutdown().finally(() => process.exit(1));
  process.exit(1);
  // Application specific logging, throwing an error, or other logic here
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  tryShutdown().finally(() => process.exit(1));
});

const tryShutdown = async () => {
    console.log("tryShutdown called.");
    let quitProperly = true;
    try {
        if (global.client && typeof global.client.destroy === 'function') {
            console.log("Attempting to destroy Discord client...");
            await global.client.destroy();
            console.log("Discord client destroyed.");
        }
        // Player stop might not be necessary if connection is destroyed.
        // if (global.player && typeof global.player.stop === 'function') {
        //     console.log("Attempting to stop audio player...");
        //     global.player.stop(true);
        // }
        if (global.connection && typeof global.connection.destroy === 'function') {
            console.log("Attempting to destroy voice connection...");
            global.connection.destroy(); // This should be synchronous or return a promise if it's async
            console.log("Voice connection destroyed.");
        }
        // app.quit() is problematic in a non-Electron environment
        // if (global.app && typeof global.app.quit === 'function') {
        //     console.log("Attempting to quit Electron app...");
        //     global.app.quit(); // This might also be async or have side effects
        // }
    } catch (e) {
        console.warn("Error during graceful shutdown attempt:", e.message);
        quitProperly = false;
    }
    return quitProperly;
};
