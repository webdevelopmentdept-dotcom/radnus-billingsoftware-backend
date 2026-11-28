/* =====================================================================
   RADNUS BILLING - READ-ONLY DATABASE BACKUP
   ---------------------------------------------------------------------
   Idhu un database-a MATTUM PADIKKUM. Edhaiyum write / update / delete
   pannaadhu. (find(), countDocuments(), listCollections() mattum use
   pannudhu.)

   Run panra vidham (backend folder kulla):
       node backup.js

   Output:
       backend/backups/backup-YYYY-MM-DD_HH-MM/
           jobsheets.json, users.json, engineers.json ... (collection-ku oru file)
           _summary.json   (evlo records, verify result)
   ===================================================================== */

const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]); // server.js-la irukura maariye (Atlas connect aaga)

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// EJSON = ObjectId, Date ellam sariya save aagum (restore panna exact-ah thirumbum)
const { EJSON } = mongoose.mongo.BSON;

const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const stamp =
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
  `_${pad(now.getHours())}-${pad(now.getMinutes())}`;

const OUT_DIR = path.join(__dirname, "backups", `backup-${stamp}`);

// Oru collection-a stream pannitu file-ku ezhudhum (periya collection-um memory-la nirambaadhu)
async function exportCollection(db, name) {
  const file = path.join(OUT_DIR, `${name}.json`);
  const out = fs.createWriteStream(file, { encoding: "utf8" });

  const write = (text) =>
    new Promise((resolve, reject) => {
      out.write(text, (err) => (err ? reject(err) : resolve()));
    });

  const expected = await db.collection(name).countDocuments({});
  const cursor = db.collection(name).find({});

  await write("[\n");
  let written = 0;
  for await (const doc of cursor) {
    await write((written ? ",\n" : "") + EJSON.stringify(doc, { relaxed: false }));
    written++;
  }
  await write("\n]\n");
  await new Promise((resolve) => out.end(resolve));

  const sizeKB = Math.round(fs.statSync(file).size / 1024);
  return { name, expected, written, sizeKB, ok: expected === written };
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("❌ .env-la MONGO_URI illa. backend folder-la dhaan run panra nu check pannu.");
    process.exit(1);
  }

  console.log("🔌 Database-ku connect aaguren (read-only)...");
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log(`✅ Connected. Database: ${db.databaseName}\n`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system."))
    .sort();

  console.log(`📦 ${collections.length} collections kedaichuchu. Backup aaguthu...\n`);

  const results = [];
  for (const name of collections) {
    try {
      const r = await exportCollection(db, name);
      results.push(r);
      console.log(
        `${r.ok ? "✅" : "⚠️ "} ${name.padEnd(24)} ${String(r.written).padStart(7)} records  (${r.sizeKB} KB)` +
          (r.ok ? "" : `   <-- MISMATCH: DB-la ${r.expected}, file-la ${r.written}`)
      );
    } catch (err) {
      results.push({ name, ok: false, error: err.message });
      console.log(`❌ ${name} FAILED: ${err.message}`);
    }
  }

  const totalRecords = results.reduce((s, r) => s + (r.written || 0), 0);
  const allOk = results.every((r) => r.ok);

  fs.writeFileSync(
    path.join(OUT_DIR, "_summary.json"),
    JSON.stringify(
      {
        database: db.databaseName,
        backedUpAt: now.toISOString(),
        totalCollections: results.length,
        totalRecords,
        allVerified: allOk,
        collections: results,
      },
      null,
      2
    )
  );

  console.log("\n==================================================");
  console.log(allOk ? "🎉 BACKUP SUCCESS - ellam verify aachu" : "⚠️  BACKUP-la sila problem irukku, mela paaru");
  console.log(`📁 Folder : ${OUT_DIR}`);
  console.log(`🧾 Total  : ${results.length} collections, ${totalRecords} records`);
  console.log("==================================================");

  await mongoose.disconnect();
  process.exit(allOk ? 0 : 2);
}

main().catch(async (err) => {
  console.error("\n❌ BACKUP FAILED:", err.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});