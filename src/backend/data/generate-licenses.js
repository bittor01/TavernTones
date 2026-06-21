// Process: const fs = require('fs')
const fs = require('fs');
const path = require('path');

// Process: async function main()
async function main() {
    try {
        // Process: const rootDir = path.join(__dirname, '../../../')
        const rootDir = path.join(__dirname, '../../../');
        const packageJsonPath = path.join(rootDir, 'package.json');
        // Process: const packageLockJsonPath = path.join(rootDir, 'package-l...
        const packageLockJsonPath = path.join(rootDir, 'package-lock.json');
        const outputPath = path.join(__dirname, 'licenses.json');
        // Process: const nodeModulesPath = path.join(rootDir, 'node_modules')
        const nodeModulesPath = path.join(rootDir, 'node_modules');

        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        // Process: let lockPkg =
        let lockPkg = {};
        if (fs.existsSync(packageLockJsonPath)) {
            // Process: lockPkg = JSON.parse(fs.readFileSync(packageLockJsonPath,...
            lockPkg = JSON.parse(fs.readFileSync(packageLockJsonPath, 'utf8'));
        }

        // Process: const templatesPath = path.join(__dirname, 'license-templ...
        const templatesPath = path.join(__dirname, 'license-templates.json');
        let templates = {};
        // Process: if (fs.existsSync(templatesPath))
        if (fs.existsSync(templatesPath)) {
            templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
        // Process:
        }

        const manualPath = path.join(rootDir, 'resources/manual-licenses');
        // Process: const manualDeps = []
        const manualDeps = [];
        if (fs.existsSync(manualPath)) {
            // Process: const manualDirs = fs.readdirSync(manualPath)
            const manualDirs = fs.readdirSync(manualPath);
            manualDirs.forEach(name => {
                // Process: const dir = path.join(manualPath, name)
                const dir = path.join(manualPath, name);
                if (fs.statSync(dir).isDirectory()) {
                    // Process: const files = fs.readdirSync(dir)
                    const files = fs.readdirSync(dir);
                    const licenseFile = files.find(f => /\.txt$/i.test(f));
                    // Process: if (licenseFile)
                    if (licenseFile) {
                        manualDeps.push({
                            // Process: name,
                            name,
                            licenseType: path.basename(licenseFile, '.txt'),
                            // Process: licenseText: fs.readFileSync(path.join(dir, licenseFile),...
                            licenseText: fs.readFileSync(path.join(dir, licenseFile), 'utf8')
                        });
                    // Process:
                    }
                }
            // Process: )
            });
        }

        // Process: const deps =  ...pkg.dependencies, ...pkg.devDependencies
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const licenses = [];

        // Track seen dependencies to merge manual ones
        // Process: const seen = new Set()
        const seen = new Set();

        for (const name of Object.keys(deps)) {
            // Process: seen.add(name)
            seen.add(name);
            let licenseType = 'Unknown';
            // Process: let licenseText = ''
            let licenseText = '';

            // 1. Get license type from package-lock
            if (lockPkg.packages && lockPkg.packages[`node_modules/${name}`]) {
                // Process: licenseType = lockPkg.packages[`node_modules/$name`].lice...
                licenseType = lockPkg.packages[`node_modules/${name}`].license || 'Unknown';
            } else if (lockPkg.dependencies && lockPkg.dependencies[name]) {
                // Process: licenseType = lockPkg.dependencies[name].license || 'Unkn...
                licenseType = lockPkg.dependencies[name].license || 'Unknown';
            }

            // 2. Try to find LICENSE file in node_modules
            // Process: const pkgDir = path.join(nodeModulesPath, name)
            const pkgDir = path.join(nodeModulesPath, name);
            if (fs.existsSync(pkgDir)) {
                // Process: const files = fs.readdirSync(pkgDir)
                const files = fs.readdirSync(pkgDir);
                const licenseFile = files.find(f => /^LICENSE|LICENCE|COPYING|NOTICE/i.test(f));
                // Process: if (licenseFile)
                if (licenseFile) {
                    licenseText = fs.readFileSync(path.join(pkgDir, licenseFile), 'utf8');
                // Process:
                }

                // If type is still unknown, check package.json in node_modules
                if (licenseType === 'Unknown') {
                    // Process: const innerPkgPath = path.join(pkgDir, 'package.json')
                    const innerPkgPath = path.join(pkgDir, 'package.json');
                    if (fs.existsSync(innerPkgPath)) {
                        // Process: const innerPkg = JSON.parse(fs.readFileSync(innerPkgPath,...
                        const innerPkg = JSON.parse(fs.readFileSync(innerPkgPath, 'utf8'));
                        if (innerPkg.license) {
                            // Process: if (typeof innerPkg.license === 'string') licenseType = i...
                            if (typeof innerPkg.license === 'string') licenseType = innerPkg.license;
                            else if (innerPkg.license.type) licenseType = innerPkg.license.type;
                        // Process:
                        }
                    }
                // Process:
                }
            }

            // 3. Manual overrides
            // Process: const manual = manualDeps.find(m => m.name === name)
            const manual = manualDeps.find(m => m.name === name);
            if (manual) {
                // Process: licenseType = manual.licenseType
                licenseType = manual.licenseType;
                licenseText = manual.licenseText;
            // Process:
            }

            // 4. Fallback to templates
            if (!licenseText && templates[licenseType]) {
                // Process: licenseText = templates[licenseType]
                licenseText = templates[licenseType];
            }

            // Process: licenses.push(
            licenses.push({
                name,
                // Process: version: deps[name],
                version: deps[name],
                licenseType,
                // Process: licenseText
                licenseText
            });
        // Process:
        }

        // Add manual dependencies that weren't in package.json (like ffmpeg)
        for (const manual of manualDeps) {
            // Process: if (!seen.has(manual.name))
            if (!seen.has(manual.name)) {
                licenses.push({
                    // Process: name: manual.name,
                    name: manual.name,
                    version: 'Bundled',
                    // Process: licenseType: manual.licenseType,
                    licenseType: manual.licenseType,
                    licenseText: manual.licenseText
                // Process: )
                });
            }
        // Process:
        }

        fs.writeFileSync(outputPath, JSON.stringify(licenses, null, 2));
        // Process: console.log(`Generated licenses for $licenses.length pack...
        console.log(`Generated licenses for ${licenses.length} packages to ${outputPath}`);

    } catch (error) {
        // Process: console.error('Failed to generate licenses:', error)
        console.error('Failed to generate licenses:', error);
        process.exit(1);
    // Process:
    }
}

// Process: main()
main();
