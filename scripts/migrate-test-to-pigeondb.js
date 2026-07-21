// One-off recovery: copy user work from the legacy `test` DB (where Mongoose used
// to default before config/db.js pinned dbName=pigeon_db) into pigeon_db, remapping
// old orphaned user ids to current ids. Idempotent: skips any _id already present.
// Backs up both DBs to backups/ first. Run: node scripts/migrate-test-to-pigeondb.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017';

// Old id -> current id (matched by googleId across the two DBs).
const ID_MAP = {
  '67e8d60c5c32d0e46575a0fc': '69408cfbb5e5258e469703ec', // ranshiv369@gmail.com
  '6807389cd4f42ca6a845012f': '6a5f137019b5929654c2d797'  // bootloader101010@gmail.com (Kernel)
};

// Remap a single id-like value (ObjectId or string) if it's in the map; else unchanged.
function remapId(val) {
  if (val == null) return val;
  const key = String(val);
  if (ID_MAP[key]) return new ObjectId(ID_MAP[key]);
  return val; // preserve original type/value
}

// Per-collection: which fields hold owner/user references to remap.
const REMAP = {
  histories: (d) => { d.userId = remapId(d.userId); },
  requests: (d) => { if (d.owner != null) d.owner = remapId(d.owner); },
  collections: (d) => {
    if (d.owner != null) d.owner = remapId(d.owner);
    if (Array.isArray(d.collaborators)) d.collaborators.forEach(c => { if (c.userId != null) c.userId = remapId(c.userId); });
  }
};

const COLLECTIONS = ['histories', 'requests', 'collections'];

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const test = client.db('test');
  const pg = client.db('pigeon_db');

  // 1) Back up both DBs (all collections) to timestamped JSON.
  const stamp = process.env.BACKUP_STAMP || 'manual';
  const backupDir = path.join(__dirname, '..', 'backups', `db-backup-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  for (const [name, db] of [['test', test], ['pigeon_db', pg]]) {
    const cols = await db.listCollections().toArray();
    for (const { name: col } of cols) {
      const docs = await db.collection(col).find({}).toArray();
      fs.writeFileSync(path.join(backupDir, `${name}.${col}.json`), JSON.stringify(docs, null, 2));
    }
  }
  console.log('Backup written to', backupDir);

  // 2) Copy + remap, skipping _ids already in pigeon_db.
  for (const col of COLLECTIONS) {
    const existing = new Set((await pg.collection(col).find({}, { projection: { _id: 1 } }).toArray()).map(d => String(d._id)));
    const src = await test.collection(col).find({}).toArray();
    const toInsert = [];
    let skipped = 0;
    for (const doc of src) {
      if (existing.has(String(doc._id))) { skipped++; continue; }
      if (REMAP[col]) REMAP[col](doc);
      toInsert.push(doc);
    }
    if (toInsert.length) await pg.collection(col).insertMany(toInsert, { ordered: false });
    console.log(`${col}: inserted ${toInsert.length}, skipped ${skipped} (already present)`);
  }

  // 3) Verify: how much the current user now owns in pigeon_db.
  const me = new ObjectId('69408cfbb5e5258e469703ec');
  const hist = await pg.collection('histories').countDocuments({ userId: me });
  const cols = await pg.collection('collections').countDocuments({ owner: me });
  const reqs = await pg.collection('requests').countDocuments({});
  console.log(`\nVERIFY pigeon_db — histories owned by you: ${hist}, collections owned by you: ${cols}, total requests: ${reqs}`);

  await client.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
