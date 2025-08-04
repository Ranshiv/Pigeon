// scripts/remove-empty-files.js
// Script to remove all empty files from the project except in node_modules

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const EXCLUDE_DIRS = ['node_modules'];

function isExcluded(filePath) {
    return EXCLUDE_DIRS.some(exclude => filePath.split(path.sep).includes(exclude));
}

function removeEmptyFiles(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        if (isExcluded(fullPath)) return;
        if (entry.isDirectory()) {
            removeEmptyFiles(fullPath);
        } else if (entry.isFile()) {
            try {
                const stats = fs.statSync(fullPath);
                if (stats.size === 0) {
                    fs.unlinkSync(fullPath);
                    console.log(`Deleted empty file: ${fullPath}`);
                }
            } catch (err) {
                console.error(`Error processing file ${fullPath}:`, err);
            }
        }
    });
}

removeEmptyFiles(ROOT_DIR);
console.log('Empty file removal complete.');
