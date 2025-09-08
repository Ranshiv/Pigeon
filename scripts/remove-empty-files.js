#!/usr/bin/env node
/**
 * Remove empty or whitespace-only files in the project.
 *
 * Defaults to dry-run. Pass --apply to actually delete.
 *
 * Options:
 *  --apply, -y             Perform deletion (default is dry-run)
 *  --cwd <path>            Root directory to scan (default: repo root)
 *  --maxCheckBytes <n>     Max bytes to read when checking whitespace-only (default: 65536)
 *  --skipWhitespace        Only treat size==0 as empty; skip whitespace-only check
 *  --prune-empty-dirs      After deleting files, prune now-empty directories
 *  --quiet                 Reduce output; only print summary and deletions
 *  --includeExt .log,.tmp  Comma-separated list of extensions to consider (default: all)
 *  --excludeExt .bin       Comma-separated list of extensions to ignore
 */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [--apply] [--cwd <path>]')
    .option('apply', { alias: 'y', type: 'boolean', default: false, describe: 'Actually delete files' })
    .option('cwd', { type: 'string', default: path.resolve(__dirname, '..'), describe: 'Root directory to scan' })
    .option('maxCheckBytes', { type: 'number', default: 65536, describe: 'Max bytes to read for whitespace-only detection' })
    .option('skipWhitespace', { type: 'boolean', default: false, describe: 'Only treat zero-byte files as empty' })
    .option('prune-empty-dirs', { type: 'boolean', default: false, describe: 'Remove directories that become empty' })
    .option('quiet', { type: 'boolean', default: false, describe: 'Reduce output' })
    .option('includeExt', { type: 'string', describe: 'Comma-separated list of extensions to include (e.g., .log,.tmp)' })
    .option('excludeExt', { type: 'string', describe: 'Comma-separated list of extensions to exclude' })
    .help()
    .alias('h', 'help')
    .epilog('Pigeon: remove-empty-files')
    .parse();

const ROOT = path.resolve(argv.cwd);

const DEFAULT_IGNORED_DIRS = new Set([
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    '.vscode',
    '.idea',
    'dist',
    'build',
    'coverage',
    '.cache',
    '.next',
    'out',
    'tmp',
]);

/**
 * Decide if a directory entry should be ignored based on its path segments.
 */
function isIgnoredDir(fullPath) {
    const parts = fullPath.split(path.sep);
    return parts.some((p) => DEFAULT_IGNORED_DIRS.has(p));
}

function toSetFromCSV(csv) {
    if (!csv) return null;
    return new Set(csv.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (s.startsWith('.') ? s.toLowerCase() : `.${s.toLowerCase()}`)));
}

const includeExt = toSetFromCSV(argv.includeExt);
const excludeExt = toSetFromCSV(argv.excludeExt);

function extIncluded(ext) {
    const e = (ext || '').toLowerCase();
    if (excludeExt && excludeExt.has(e)) return false;
    if (includeExt) return includeExt.has(e);
    return true; // all by default
}

async function isWhitespaceOnly(filePath, maxBytes) {
    try {
        const stat = await fsp.stat(filePath);
        if (stat.size === 0) return true;
        if (argv.skipWhitespace) return false;
        const bytesToRead = Math.min(stat.size, maxBytes);
        const fh = await fsp.open(filePath, 'r');
        try {
            const buf = Buffer.alloc(bytesToRead);
            await fh.read(buf, 0, bytesToRead, 0);
            // If the portion read is whitespace-only and file size <= maxBytes, treat as empty-like
            if (stat.size <= maxBytes) {
                return buf.toString('utf8').trim().length === 0;
            }
            // For large files, do a heuristic: sample start and end
            const head = buf.toString('utf8');
            if (head.trim().length !== 0) return false;
            // sample tail
            const tailBytes = Math.min(4096, stat.size);
            const tailBuf = Buffer.alloc(tailBytes);
            await fh.read(tailBuf, 0, tailBytes, stat.size - tailBytes);
            return tailBuf.toString('utf8').trim().length === 0;
        } finally {
            await fh.close();
        }
    } catch (err) {
        return false; // On error, do not treat as empty
    }
}

async function* walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (isIgnoredDir(full)) continue;
            yield* walk(full);
        } else if (entry.isFile()) {
            yield full;
        } else if (entry.isSymbolicLink()) {
            // skip symlinks for safety
            continue;
        }
    }
}

async function removeEmptyFiles(root) {
    const candidates = [];
    for await (const filePath of walk(root)) {
        const ext = path.extname(filePath);
        if (!extIncluded(ext)) continue;
        try {
            const stat = await fsp.stat(filePath);
            if (!stat.isFile()) continue;
            const emptyLike = stat.size === 0 || (await isWhitespaceOnly(filePath, argv.maxCheckBytes));
            if (emptyLike) candidates.push(filePath);
        } catch (e) {
            // ignore inaccessible files
        }
    }

    if (!argv.quiet) {
        console.log(`Scanning root: ${root}`);
        console.log(`Ignored dirs: ${Array.from(DEFAULT_IGNORED_DIRS).join(', ')}`);
        if (includeExt) console.log(`Include extensions: ${Array.from(includeExt).join(', ')}`);
        if (excludeExt) console.log(`Exclude extensions: ${Array.from(excludeExt).join(', ')}`);
    }

    if (candidates.length === 0) {
        console.log('No empty or whitespace-only files found.');
        return { deleted: 0, files: [] };
    }

    if (!argv.quiet) {
        console.log(`Found ${candidates.length} empty file(s):`);
        for (const f of candidates) console.log(` - ${path.relative(root, f)}`);
    }

    if (!argv.apply) {
        console.log('\nDry-run: no files were deleted. Re-run with --apply to delete.');
        return { deleted: 0, files: candidates };
    }

    let deleted = 0;
    for (const f of candidates) {
        try {
            await fsp.unlink(f);
            deleted++;
            if (!argv.quiet) console.log(`Deleted: ${path.relative(root, f)}`);
        } catch (e) {
            console.warn(`Failed to delete ${f}: ${e.message}`);
        }
    }

    if (argv['prune-empty-dirs']) {
        await pruneEmptyDirs(root);
    }

    console.log(`\nDone. Deleted ${deleted} file(s).`);
    return { deleted, files: candidates };
}

async function pruneEmptyDirs(root) {
    // Post-order traversal to remove empty directories
    async function prune(dir) {
        if (isIgnoredDir(dir)) return false;
        let entries;
        try {
            entries = await fsp.readdir(dir, { withFileTypes: true });
        } catch {
            return false;
        }
        let isEmpty = true;
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const childEmpty = await prune(full);
                if (!childEmpty) isEmpty = false;
            } else if (entry.isFile()) {
                isEmpty = false;
            }
        }
        if (isEmpty && dir !== root) {
            try {
                await fsp.rmdir(dir);
                if (!argv.quiet) console.log(`Pruned empty dir: ${path.relative(root, dir)}`);
                return true;
            } catch {
                return false;
            }
        }
        return isEmpty;
    }
    await prune(root);
}

(async () => {
    const start = Date.now();
    const { deleted } = await removeEmptyFiles(ROOT);
    if (!argv.quiet) {
        const ms = Date.now() - start;
        console.log(`Time: ${ms}ms | Mode: ${argv.apply ? 'apply' : 'dry-run'}`);
    }
    // Windows-friendly exit
    process.exitCode = 0;
})();
