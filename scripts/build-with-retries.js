const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const MAX_RETRIES = 3;
const BUILD_DIR = path.join(__dirname, '..', 'build');

async function runBuild(attempt = 1) {
    console.log(`--- Build Attempt ${attempt} of ${MAX_RETRIES} ---`);

    try {
        // Step 1: Clean the build directory
        console.log(`Cleaning directory: ${BUILD_DIR}`);
        await fs.remove(BUILD_DIR);
        console.log('Directory cleaned.');

        // Step 2: Run electron-builder
        console.log('Starting electron-builder...');
        await new Promise((resolve, reject) => {
            const builderProcess = exec('npx electron-builder --win');

            builderProcess.stdout.on('data', (data) => {
                console.log(data.toString());
            });

            builderProcess.stderr.on('data', (data) => {
                console.error(data.toString());
            });

            builderProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('electron-builder finished successfully.');
                    resolve();
                } else {
                    reject(new Error(`electron-builder exited with code ${code}`));
                }
            });
        });

        console.log('--- Build Succeeded! ---');

    } catch (error) {
        console.error(`Build Attempt ${attempt} failed: ${error.message}`);
        if (attempt < MAX_RETRIES) {
            console.log('Retrying...');
            await runBuild(attempt + 1);
        } else {
            console.error('--- Maximum retries reached. Build failed. ---');
            process.exit(1); // Exit with error code
        }
    }
}

runBuild();
