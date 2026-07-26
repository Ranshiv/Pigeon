const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const FORMAT_VERSION = 1;
const MANIFEST_FILE = 'manifest.json';
const SENSITIVE_KEY = /(?:authorization|api[-_]?key|token|secret|password|cookie|client[-_]?secret)/i;

const plain = (value) => value && typeof value.toObject === 'function' ? value.toObject() : value;
const cleanId = (value) => value == null ? '' : String(value);

function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((out, key) => {
        if (value[key] !== undefined) out[key] = canonicalize(value[key]);
        return out;
    }, {});
}

function stableJson(value) { return `${JSON.stringify(canonicalize(value), null, 2)}\n`; }
function hash(value) { return crypto.createHash('sha256').update(stableJson(value)).digest('hex'); }

function slug(value, fallback = 'item') {
    const result = String(value || fallback).normalize('NFKD').replace(/[^\w\s-]/g, '')
        .trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').toLowerCase();
    return result || fallback;
}

function redact(value, key = '') {
    if (SENSITIVE_KEY.test(key)) return '{{PIGEON_SECRET}}';
    if (Array.isArray(value)) return value.map((item) => redact(item));
    if (!value || typeof value !== 'object') return value;
    return Object.entries(value).reduce((out, [childKey, childValue]) => {
        out[childKey] = redact(childValue, childKey);
        return out;
    }, {});
}

function stripNestedIds(value, depth = 0) {
    if (Array.isArray(value)) return value.map((item) => stripNestedIds(item, depth + 1));
    if (!value || typeof value !== 'object') return value;
    return Object.entries(value).reduce((out, [key, child]) => {
        // Request identity is stored separately as pigeonId. Nested schema IDs
        // are internal Mongoose implementation details and are not portable.
        if (key === '_id' && depth > 0) return out;
        out[key] = stripNestedIds(child, depth + 1);
        return out;
    }, {});
}

function sanitizeRequestForPersistence(request) {
    const source = plain(request) || {};
    const result = {
        name: source.name || 'Untitled request',
        description: source.description || '',
        url: source.url || '',
        method: source.method || 'GET',
        protocol: source.protocol || 'http',
        headers: stripNestedIds(Array.isArray(source.headers) ? source.headers : []),
        params: stripNestedIds(Array.isArray(source.params) ? source.params : []),
        body: typeof source.body === 'string' ? source.body : '',
        bodyType: source.bodyType || 'none',
        bodyFormData: stripNestedIds(Array.isArray(source.bodyFormData) ? source.bodyFormData : []),
        graphql: stripNestedIds(source.graphql && typeof source.graphql === 'object' ? source.graphql : {}),
        preRequestScript: source.preRequestScript || '',
        testScript: source.testScript || '',
        tests: source.tests || '',
        authConfig: stripNestedIds(source.authConfig && typeof source.authConfig === 'object' ? source.authConfig : {}),
        sslConfig: stripNestedIds(source.sslConfig && typeof source.sslConfig === 'object' ? source.sslConfig : {}),
        folderPath: Array.isArray(source.folderPath) ? source.folderPath.map(String) : [],
        metadata: stripNestedIds(source.metadata && typeof source.metadata === 'object' ? source.metadata : {}),
        order: Number.isFinite(Number(source.order)) ? Number(source.order) : 0
    };
    if (source._id) result._id = cleanId(source._id);
    const createdAt = validDate(source.createdAt);
    const updatedAt = validDate(source.updatedAt);
    if (createdAt) result.createdAt = createdAt;
    if (updatedAt) result.updatedAt = updatedAt;
    return result;
}

function validDate(value) {
    if (!value || (typeof value === 'object' && !(value instanceof Date))) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function serializeVariable(variable) {
    const source = plain(variable) || {};
    return {
        key: source.key || '',
        value: source.isSecret ? '{{PIGEON_SECRET}}' : String(source.value ?? ''),
        description: source.description || '', type: source.type || 'string',
        isSecret: Boolean(source.isSecret), enabled: source.enabled !== false
    };
}

function serializeRequest(request, order) {
    const source = plain(request) || {};
    const requestId = cleanId(source._id || source.id);
    return redact(stripNestedIds({
        formatVersion: FORMAT_VERSION,
        pigeonId: requestId || undefined,
        name: source.name || 'Untitled request', description: source.description || '',
        method: source.method || 'GET', protocol: source.protocol || 'http', url: source.url || '',
        order: Number.isFinite(source.order) ? source.order : order,
        folderPath: Array.isArray(source.folderPath) ? source.folderPath : [],
        headers: source.headers || [], params: source.params || [], body: source.body || '',
        bodyType: source.bodyType || 'none', bodyFormData: source.bodyFormData || [],
        graphql: source.graphql || {}, preRequestScript: source.preRequestScript || '',
        testScript: source.testScript || '', tests: source.tests || '',
        authConfig: source.authConfig || {}, sslConfig: source.sslConfig || {}, metadata: source.metadata || {}
    }));
}

function buildExport(collection) {
    const source = plain(collection) || {};
    const collectionId = cleanId(source._id);
    const collectionSlug = slug(source.name, `collection-${collectionId.slice(-8) || 'local'}`);
    const files = new Map();
    const requests = Array.isArray(source.requests) ? source.requests : [];
    const usedNames = new Set();
    const requestFiles = [];

    requests.forEach((request, index) => {
        const data = serializeRequest(request, index);
        const idSuffix = (data.pigeonId || String(index + 1)).slice(-8);
        let name = `${slug(data.name, 'request')}-${idSuffix}.json`;
        let duplicate = 2;
        while (usedNames.has(name)) name = `${slug(data.name, 'request')}-${idSuffix}-${duplicate++}.json`;
        usedNames.add(name);
        const relative = path.posix.join('requests', name);
        requestFiles.push({ pigeonId: data.pigeonId || '', path: relative, hash: hash(data), order: data.order });
        files.set(relative, stableJson(data));
    });

    const collectionDocument = {
        formatVersion: FORMAT_VERSION, pigeonId: collectionId || undefined,
        name: source.name || 'Untitled collection', description: source.description || '',
        version: source.version || '1.0.0', branch: source.branch || 'main',
        tags: Array.isArray(source.tags) ? [...source.tags].sort() : [],
        category: source.category || '', variables: (source.variables || []).map(serializeVariable),
        requestFiles
    };
    files.set('collection.json', stableJson(collectionDocument));
    files.set('README.md', `# ${collectionDocument.name}\n\n${collectionDocument.description || 'Pigeon local-first collection.'}\n`);
    const manifest = {
        formatVersion: FORMAT_VERSION, managedBy: 'Pigeon', collectionId,
        collectionPath: collectionSlug,
        files: [...files.keys()].sort()
    };
    files.set(MANIFEST_FILE, stableJson(manifest));
    return { collectionSlug, files, manifest, databaseHash: hash(collectionDocument), filesystemHash: hash({ collection: collectionDocument, requests: [...files.entries()].filter(([file]) => file.startsWith('requests/')).map(([, content]) => JSON.parse(content)) }) };
}

async function pathExists(target) { try { await fs.access(target); return true; } catch { return false; } }

function safeRelative(value) {
    const normalized = path.posix.normalize(String(value || '').replace(/\\/g, '/')).replace(/^\/+/, '');
    if (!normalized || normalized === '.' || normalized.split('/').includes('..')) throw new Error('A safe relative collection path is required');
    return normalized;
}

async function resolveRepository(repositoryPath) {
    if (!path.isAbsolute(String(repositoryPath || ''))) throw new Error('Repository path must be absolute');
    const resolved = path.resolve(repositoryPath);
    const stat = await fs.stat(resolved).catch(() => null);
    if (!stat?.isDirectory()) throw new Error('Repository path must be an existing directory');
    return fs.realpath(resolved);
}

async function atomicWrite(filePath, content) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, content, 'utf8');
    await fs.rename(temporary, filePath);
}

async function exportCollection({ collection, repositoryPath, relativeCollectionPath }) {
    const repository = await resolveRepository(repositoryPath);
    const relative = safeRelative(relativeCollectionPath || path.posix.join('.pigeon', 'collections', slug(collection.name)));
    const destination = path.resolve(repository, relative);
    if (destination !== repository && !destination.startsWith(`${repository}${path.sep}`)) throw new Error('Collection path must stay inside the repository');
    const built = buildExport(collection);
    const previousPath = path.join(destination, MANIFEST_FILE);
    let previous = null;
    try { previous = JSON.parse(await fs.readFile(previousPath, 'utf8')); } catch { /* first export */ }
    const summary = { created: [], updated: [], unchanged: [], removed: [] };
    for (const [relativeFile, content] of built.files) {
        const filePath = path.join(destination, ...relativeFile.split('/'));
        const previousContent = await fs.readFile(filePath, 'utf8').catch(() => null);
        if (previousContent === content) summary.unchanged.push(relativeFile);
        else {
            await atomicWrite(filePath, content);
            summary[previousContent === null ? 'created' : 'updated'].push(relativeFile);
        }
    }
    for (const oldFile of previous?.files || []) {
        if (built.files.has(oldFile)) continue;
        const oldPath = path.join(destination, ...String(oldFile).split('/'));
        if (oldPath.startsWith(`${destination}${path.sep}`) && await pathExists(oldPath)) {
            await fs.unlink(oldPath); summary.removed.push(oldFile);
        }
    }
    return { repositoryPath: repository, relativeCollectionPath: relative.replace(/\\/g, '/'), databaseHash: built.databaseHash, filesystemHash: built.filesystemHash, summary };
}

function safeLocalFile(root, relativeFile) {
    const relative = safeRelative(relativeFile);
    const resolved = path.resolve(root, ...relative.split('/'));
    if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error('Manifest contains a path outside the collection directory');
    return resolved;
}

async function readJson(filePath, label) {
    let raw;
    try { raw = await fs.readFile(filePath, 'utf8'); }
    catch { throw new Error(`${label} is missing`); }
    try { return JSON.parse(raw); }
    catch { throw new Error(`${label} is not valid JSON`); }
}

function validateLocalRequest(request, source) {
    if (!request || typeof request !== 'object') throw new Error(`${source} must be an object`);
    if (!request.name || !request.url || !request.method) throw new Error(`${source} needs name, method, and url`);
    return request;
}

async function readLocalCollection({ repositoryPath, relativeCollectionPath }) {
    const repository = await resolveRepository(repositoryPath);
    const relative = safeRelative(relativeCollectionPath);
    const root = path.resolve(repository, ...relative.split('/'));
    if (!root.startsWith(`${repository}${path.sep}`)) throw new Error('Collection path must stay inside the repository');
    const manifest = await readJson(path.join(root, MANIFEST_FILE), 'Pigeon manifest');
    if (manifest.managedBy !== 'Pigeon' || manifest.formatVersion !== FORMAT_VERSION || !Array.isArray(manifest.files)) {
        throw new Error(`Unsupported or invalid Pigeon format. Expected formatVersion ${FORMAT_VERSION}`);
    }
    const collection = await readJson(safeLocalFile(root, 'collection.json'), 'collection.json');
    if (!collection.name || !Array.isArray(collection.requestFiles)) throw new Error('collection.json needs a name and requestFiles array');
    const requests = [];
    for (const descriptor of collection.requestFiles) {
        if (!descriptor?.path || !String(descriptor.path).startsWith('requests/')) throw new Error('collection.json contains an invalid request path');
        const request = validateLocalRequest(await readJson(safeLocalFile(root, descriptor.path), descriptor.path), descriptor.path);
        requests.push(request);
    }
    const snapshot = { collection, requests };
    return { repositoryPath: repository, relativeCollectionPath: relative, root, manifest, collection, requests, filesystemHash: hash(snapshot) };
}

function diffRequests(databaseRequests, localRequests) {
    const current = new Map((databaseRequests || []).map((request) => [cleanId(plain(request)?._id), serializeRequest(request, request.order || 0)]));
    const local = new Map((localRequests || []).map((request, index) => [cleanId(request.pigeonId), request]));
    const additions = []; const modifications = []; const deletions = []; const unchanged = [];
    for (const [id, request] of local) {
        if (!id || !current.has(id)) additions.push({ id: id || null, name: request.name, local: request });
        else if (hash(current.get(id)) !== hash(request)) modifications.push({ id, name: request.name, pigeon: current.get(id), local: request });
        else unchanged.push({ id, name: request.name });
    }
    for (const [id, request] of current) if (!local.has(id)) deletions.push({ id, name: request.name, pigeon: request });
    return { additions, modifications, deletions, unchanged };
}

function applyLocalToCollection(collection, local, mode = 'merge') {
    const source = local.collection;
    if (!['merge', 'replace'].includes(mode)) throw new Error('Import mode must be merge or replace');
    const existing = new Map((collection.requests || []).map((request) => [cleanId(request._id), sanitizeRequestForPersistence(request)]));
    const imported = local.requests.map((request, index) => {
        const id = cleanId(request.pigeonId);
        const copy = sanitizeRequestForPersistence(request);
        if (mongooseId(id)) copy._id = id;
        else copy._id = newObjectId();
        copy.order = Number.isFinite(copy.order) ? copy.order : index;
        return copy;
    });
    if (mode === 'merge') {
        for (const request of imported) existing.set(cleanId(request._id), request);
        collection.requests = [...existing.values()].sort((a, b) => (a.order || 0) - (b.order || 0));
    } else collection.requests = imported;
    collection.name = source.name || collection.name;
    collection.description = source.description || '';
    collection.version = source.version || collection.version;
    collection.branch = source.branch || collection.branch;
    collection.tags = Array.isArray(source.tags) ? source.tags : [];
    collection.category = source.category || '';
    collection.variables = Array.isArray(source.variables) ? source.variables : [];
    return collection;
}

function applyResolutions(collection, local, resolutions = [], pigeonRequests = null) {
    if (!Array.isArray(resolutions) || resolutions.length === 0) return collection;
    const current = new Map((pigeonRequests || collection.requests || []).map((request) => [cleanId(request._id), plain(request)]));
    const merged = new Map((collection.requests || []).map((request) => [cleanId(request._id), plain(request)]));
    const localById = new Map((local.requests || []).map((request) => [cleanId(request.pigeonId), request]));
    for (const resolution of resolutions) {
        const id = cleanId(resolution?.id);
        const choice = resolution?.choice;
        if (!id || !['pigeon', 'local', 'both', 'manual'].includes(choice)) throw new Error('Invalid conflict resolution');
        if (choice === 'pigeon') { if (current.has(id)) merged.set(id, current.get(id)); continue; }
        let localRequest = localById.get(id);
        if (choice === 'manual') {
            if (!resolution.manual || typeof resolution.manual !== 'object') throw new Error('Manual resolution must be a request object');
            localRequest = validateLocalRequest(resolution.manual, 'Manual request');
        }
        if (!localRequest) throw new Error(`Local request ${id} is no longer available`);
        const next = sanitizeRequestForPersistence(localRequest);
        if (choice === 'both') { next._id = newObjectId(); next.name = `${next.name} (local)`; }
        else next._id = mongooseId(id) ? id : newObjectId();
        merged.set(cleanId(next._id), next);
    }
    collection.requests = [...merged.values()].sort((a, b) => (a.order || 0) - (b.order || 0));
    return collection;
}

function mongooseId(value) { return /^[a-f\d]{24}$/i.test(String(value || '')); }
function newObjectId() { return crypto.randomBytes(12).toString('hex'); }

module.exports = { FORMAT_VERSION, applyLocalToCollection, applyResolutions, buildExport, canonicalize, diffRequests, exportCollection, hash, readLocalCollection, redact, resolveRepository, safeRelative, sanitizeRequestForPersistence, stableJson };
