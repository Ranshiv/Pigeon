const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/ransh/OneDrive/Desktop/Pigeon/scripts/seedMarketplace.js';
const content = fs.readFileSync(filePath, 'utf8');

// Match each object in the array
// We look for objects that contain "id:" and "description:" but not "provider:"
const objects = content.split('},').map(s => s.trim());
const missing = [];

objects.forEach((obj) => {
    if (obj.includes('id:') && obj.includes('description:')) {
        if (!obj.includes('provider:')) {
            const idMatch = obj.match(/id:\s*'([^']*)'/);
            if (idMatch) {
                missing.push(idMatch[1]);
            }
        }
    }
});

const outPath = 'c:/Users/ransh/OneDrive/Desktop/Pigeon/missing_providers.txt';
fs.writeFileSync(outPath, missing.join('\n'));
console.log(`Found ${missing.length} missing providers. Saved to ${outPath}`);
