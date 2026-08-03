#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const { initializeConnections, getDb, client } = require('../config/db');

const apply = process.argv.includes('--apply');
const asDate = (value) => value ? new Date(value) : new Date(0);

async function main() {
    await initializeConnections();
    const db = getDb();
    const collections = await db.collection('collections').find({ documentation: { $exists: true } }).project({ name: 1, documentation: 1, updatedAt: 1 }).toArray();
    const summary = { scanned: collections.length, create: 0, embeddedNewer: 0, standaloneNewer: 0, conflicts: 0, migratedVersions: 0, apply };

    for (const collection of collections) {
        const collectionId = String(collection._id);
        const embedded = collection.documentation || {};
        const standalone = await db.collection('documentation').findOne({ collectionId });
        if (!standalone) {
            summary.create += 1;
            if (apply) await db.collection('documentation').insertOne({
                collectionId, title: embedded.title || `${collection.name} Documentation`, content: embedded.content || '', settings: embedded.settings || {},
                revision: 0, createdAt: collection.createdAt || new Date(), updatedAt: embedded.lastModifiedAt || collection.updatedAt || new Date(), migratedAt: new Date()
            });
            continue;
        }
        const same = String(standalone.content || '') === String(embedded.content || '') && JSON.stringify(standalone.settings || {}) === JSON.stringify(embedded.settings || {});
        if (same) continue;
        summary.conflicts += 1;
        const embeddedDate = asDate(embedded.lastModifiedAt || collection.updatedAt);
        const standaloneDate = asDate(standalone.updatedAt);
        const winner = embeddedDate > standaloneDate ? 'embedded' : 'standalone';
        summary[winner === 'embedded' ? 'embeddedNewer' : 'standaloneNewer'] += 1;
        if (apply) {
            await db.collection('documentationMigrationConflicts').insertOne({ collectionId, winner, embeddedUpdatedAt: embeddedDate, standaloneUpdatedAt: standaloneDate, embeddedContent: embedded.content || '', standaloneContent: standalone.content || '', createdAt: new Date() });
            if (winner === 'embedded') await db.collection('documentation').updateOne({ _id: standalone._id }, { $set: { title: embedded.title || standalone.title, content: embedded.content || '', settings: embedded.settings || {}, revision: Number(standalone.revision || 0) + 1, updatedAt: embeddedDate, migratedAt: new Date() } });
            else await db.collection('collections').updateOne({ _id: collection._id }, { $set: { 'documentation.title': standalone.title || '', 'documentation.content': standalone.content || '', 'documentation.settings': standalone.settings || {}, 'documentation.lastModifiedAt': standaloneDate } });
        }
    }

    const legacySources = ['documentationContentVersions', 'documentationSettingsVersions'];
    for (const sourceName of legacySources) {
        const cursor = db.collection(sourceName).find({});
        for await (const version of cursor) {
            const migrationKey = `${sourceName}:${version._id}`;
            if (await db.collection('documentationVersions').findOne({ migrationKey }, { projection: { _id: 1 } })) continue;
            summary.migratedVersions += 1;
            if (apply) await db.collection('documentationVersions').insertOne({
                collectionId: String(version.collectionId), title: version.title || '', content: version.content || '', settings: version.settings || {},
                revision: Number(version.revision || 0), source: sourceName === 'documentationContentVersions' ? (version.importedFrom || 'legacy-content') : 'legacy-settings',
                message: version.message || 'Migrated legacy documentation version', createdBy: version.userId || null,
                createdAt: version.createdAt || version.timestamp || new Date(), migrationKey
            });
        }
    }

    console.log(JSON.stringify(summary, null, 2));
    if (!apply) console.log('Dry run only. Re-run with --apply after reviewing the summary.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await Promise.allSettled([client.close(), mongoose.disconnect()]);
});
