// Import standard filesystem and path modules to traverse the project structure
const fs = require('fs');
const path = require('path');

/**
 * Main script to aggregate license information for all dependencies.
 * It scans package.json, package-lock.json, and node_modules to build a
 * comprehensive list of licenses for legal compliance.
 */
async function main() {
    try {
        // Resolve absolute paths for project root and key metadata files
        const rootDir = path.join(__dirname, '../../../');
        const packageJsonPath = path.join(rootDir, 'package.json');
        const packageLockJsonPath = path.join(rootDir, 'package-lock.json');
        // The final JSON file containing all license data
        const outputPath = path.join(__dirname, 'licenses.json');
        const nodeModulesPath = path.join(rootDir, 'node_modules');

        // Parse the primary package.json to get the list of declared dependencies
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        let lockPkg = {};
        // Attempt to load package-lock.json for more accurate version and license metadata
        if (fs.existsSync(packageLockJsonPath)) {
            lockPkg = JSON.parse(fs.readFileSync(packageLockJsonPath, 'utf8'));
        }

        // Load generic license templates (MIT, Apache, etc.) for packages that don't bundle a full license text
        const templatesPath = path.join(__dirname, 'license-templates.json');
        let templates = {};
        if (fs.existsSync(templatesPath)) {
            templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
        }

        // Look for manually provided license files (useful for bundled binaries like FFmpeg)
        const manualPath = path.join(rootDir, 'resources/manual-licenses');
        const manualDeps = [];
        if (fs.existsSync(manualPath)) {
            // Read every folder in the manual-licenses directory
            const manualDirs = fs.readdirSync(manualPath);
            manualDirs.forEach(name => {
                const dir = path.join(manualPath, name);
                if (fs.statSync(dir).isDirectory()) {
                    const files = fs.readdirSync(dir);
                    // Find the first text file in the subdirectory
                    const licenseFile = files.find(f => /\.txt$/i.test(f));
                    if (licenseFile) {
                        // Store the manual entry with its name, type, and text content
                        manualDeps.push({
                            name,
                            licenseType: path.basename(licenseFile, '.txt'),
                            licenseText: fs.readFileSync(path.join(dir, licenseFile), 'utf8')
                        });
                    }
                }
            });
        }

        // Combine production and development dependencies
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const licenses = [];

        // Set to track processed dependencies and identify ones that only exist in manual-licenses
        const seen = new Set();

        // Iterate through every dependency in the project
        for (const name of Object.keys(deps)) {
            seen.add(name);
            let licenseType = 'Unknown';
            let licenseText = '';

            // Step 1: Attempt to extract the license type from the lockfile
            if (lockPkg.packages && lockPkg.packages[`node_modules/${name}`]) {
                licenseType = lockPkg.packages[`node_modules/${name}`].license || 'Unknown';
            } else if (lockPkg.dependencies && lockPkg.dependencies[name]) {
                licenseType = lockPkg.dependencies[name].license || 'Unknown';
            }

            // Step 2: Look for actual LICENSE files within the package's folder in node_modules
            const pkgDir = path.join(nodeModulesPath, name);
            if (fs.existsSync(pkgDir)) {
                const files = fs.readdirSync(pkgDir);
                // Look for common license filenames
                const licenseFile = files.find(f => /^LICENSE|LICENCE|COPYING|NOTICE/i.test(f));
                if (licenseFile) {
                    licenseText = fs.readFileSync(path.join(pkgDir, licenseFile), 'utf8');
                }

                // If type is still 'Unknown', check the package.json inside node_modules for this specific dependency
                if (licenseType === 'Unknown') {
                    const innerPkgPath = path.join(pkgDir, 'package.json');
                    if (fs.existsSync(innerPkgPath)) {
                        const innerPkg = JSON.parse(fs.readFileSync(innerPkgPath, 'utf8'));
                        if (innerPkg.license) {
                            // Support both string and object formats for the 'license' field
                            if (typeof innerPkg.license === 'string') licenseType = innerPkg.license;
                            else if (innerPkg.license.type) licenseType = innerPkg.license.type;
                        }
                    }
                }
            }

            // Step 3: Check for manual overrides for this dependency
            const manual = manualDeps.find(m => m.name === name);
            if (manual) {
                licenseType = manual.licenseType;
                licenseText = manual.licenseText;
            }

            // Step 4: If no license text was found on disk, use a template matching the license type
            if (!licenseText && templates[licenseType]) {
                licenseText = templates[licenseType];
            }

            // Add the gathered data to the master list
            licenses.push({
                name,
                version: deps[name],
                licenseType,
                licenseText
            });
        }

        // Step 5: Add manual dependencies that aren't listed in package.json (e.g. binaries bundled in resources/)
        for (const manual of manualDeps) {
            if (!seen.has(manual.name)) {
                licenses.push({
                    name: manual.name,
                    version: 'Bundled',
                    licenseType: manual.licenseType,
                    licenseText: manual.licenseText
                });
            }
        }

        // Write the finalized list to the output JSON file
        fs.writeFileSync(outputPath, JSON.stringify(licenses, null, 2));
        console.log(`Generated licenses for ${licenses.length} packages to ${outputPath}`);

    } catch (error) {
        // Log and exit with error code if generation fails
        console.error('Failed to generate licenses:', error);
        process.exit(1);
    }
}

// Execute the main function
main();
