const fs = require('fs');
const path = require('path');

async function main() {
    try {
        const rootDir = path.join(__dirname, '../../../');
        const packageJsonPath = path.join(rootDir, 'package.json');
        const packageLockJsonPath = path.join(rootDir, 'package-lock.json');
        const outputPath = path.join(__dirname, 'licenses.json');
        const nodeModulesPath = path.join(rootDir, 'node_modules');

        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        let lockPkg = {};
        if (fs.existsSync(packageLockJsonPath)) {
            lockPkg = JSON.parse(fs.readFileSync(packageLockJsonPath, 'utf8'));
        }

        const templatesPath = path.join(__dirname, 'license-templates.json');
        let templates = {};
        if (fs.existsSync(templatesPath)) {
            templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
        }

        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const licenses = [];

        for (const name of Object.keys(deps)) {
            let licenseType = 'Unknown';
            let licenseText = '';

            // 1. Get license type from package-lock
            if (lockPkg.packages && lockPkg.packages[`node_modules/${name}`]) {
                licenseType = lockPkg.packages[`node_modules/${name}`].license || 'Unknown';
            } else if (lockPkg.dependencies && lockPkg.dependencies[name]) {
                licenseType = lockPkg.dependencies[name].license || 'Unknown';
            }

            // 2. Try to find LICENSE file in node_modules
            const pkgDir = path.join(nodeModulesPath, name);
            if (fs.existsSync(pkgDir)) {
                const files = fs.readdirSync(pkgDir);
                const licenseFile = files.find(f => /^LICENSE|LICENCE|COPYING|NOTICE/i.test(f));
                if (licenseFile) {
                    licenseText = fs.readFileSync(path.join(pkgDir, licenseFile), 'utf8');
                }

                // If type is still unknown, check package.json in node_modules
                if (licenseType === 'Unknown') {
                    const innerPkgPath = path.join(pkgDir, 'package.json');
                    if (fs.existsSync(innerPkgPath)) {
                        const innerPkg = JSON.parse(fs.readFileSync(innerPkgPath, 'utf8'));
                        if (innerPkg.license) {
                            if (typeof innerPkg.license === 'string') licenseType = innerPkg.license;
                            else if (innerPkg.license.type) licenseType = innerPkg.license.type;
                        }
                    }
                }
            }

            // 3. Fallback to templates
            if (!licenseText && templates[licenseType]) {
                licenseText = templates[licenseType];
            }

            licenses.push({
                name,
                version: deps[name],
                licenseType,
                licenseText
            });
        }

        fs.writeFileSync(outputPath, JSON.stringify(licenses, null, 2));
        console.log(`Generated licenses for ${licenses.length} packages to ${outputPath}`);

    } catch (error) {
        console.error('Failed to generate licenses:', error);
        process.exit(1);
    }
}

main();
