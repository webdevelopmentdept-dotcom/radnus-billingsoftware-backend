/* =====================================================================
   RADNUS BILLING - RESTORE BACKUP INTO A *TEST* DATABASE
   ---------------------------------------------------------------------
   Idhu backup-a veroru TEST database-la mattum load pannum.
   Un REAL database-a touch pannave pannaadhu. Safety checks:
     1. Target database peru kattayam "-test"-la mudiyanum
     2. Target peru, .env-la irukkura real database peru-oda same-ah irukkakoodadhu
     3. "billing-software" (real DB) nu peru irundha stop aagidum
     4. Connect aanadhum, nijamave test DB-la dhaan irukkoma nu marubadi check
     5. Neeye "yes" nu type pannina dhaan start aagum

   Use panra vidham (backend folder kulla):

     node restore-to-test.js --whoami
         -> .env ippo edhu database-ku point aaguthu nu mattum kaattum (read-only)

     node restore-to-test.js backups/backup-2026-11-24_12-34
         -> backup-a "billing-software-test" database-la restore pannum

     node restore-to-test.js backups/backup-2026-11-24_12-34 --reset
         -> test DB-la already data irundha, adha azhichittu marubadi restore pannum
            (test DB-la mattum. Real DB-ku illa.)
   ===================================================================== */

const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const mongoose = require("mongoose");

const { EJSON } = mongoose.mongo.BSON;

const TEST_DB_NAME = "billing-software-test";
const PROTECTED_DB_NAMES = ["billing-software"]; // real DB - idhula ezhudha koodadhu
const BATCH_SIZE = 500;

/* ---------- helpers ---------- */

function dbNameFromUri(uri) {
  try {
    const u = new URL(uri);
    return decodeURIComponent(u.pathname.replace(/^\//, ""));
  } catch (_) {
    const m = String(uri).match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/);
    return m ? decodeURIComponent(m[1]) : "";
  }
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    })
  );
}

function fail(msg) {
  console.error(`\n🛑 ${msg}\n`);
  process.exit(1);
}

/* ---------- main ---------- */

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const whoami = args.includes("--whoami");
  const backupArg = args.find((a) => !a.startsWith("--"));

  const uri = process.env.MONGO_URI;
  if (!uri) fail(".env-la MONGO_URI illa. backend folder-la dhaan run panra nu check pannu.");

  const uriDbName = dbNameFromUri(uri);

  /* ----- --whoami : read-only check ----- */
  if (whoami) {
    console.log("\n🔍 .env ippo point aaguradhu:");
    console.log(`   Database peru (URI-la)  : ${uriDbName || "(URI-la illa)"}`);
    await mongoose.connect(uri);
    console.log(`   Nijamave connect aanadhu : ${mongoose.connection.db.databaseName}`);
    const isTest = mongoose.connection.db.databaseName.endsWith("-test");
    console.log(isTest ? "   ✅ TEST database - safe" : "   ⚠️  REAL database - test panna ethu venam!");
    await mongoose.disconnect();
    return;
  }

  /* ----- safety checks (connect aaga MUNNADI) ----- */
  if (!backupArg) {
    fail("Backup folder peru kudukkala.\nExample: node restore-to-test.js backups/backup-2026-11-24_12-34");
  }
  if (!TEST_DB_NAME.endsWith("-test")) fail("Target DB peru '-test'-la mudiyanum.");
  if (PROTECTED_DB_NAMES.includes(TEST_DB_NAME)) fail("Target DB real DB peru-ah irukku. Stop.");

  const backupDir = path.resolve(backupArg);
  if (!fs.existsSync(backupDir) || !fs.statSync(backupDir).isDirectory()) {
    fail(`Backup folder kedaikkala: ${backupDir}`);
  }

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .sort();
  if (files.length === 0) fail("Andha folder-la collection .json files illa.");

  console.log("\n==================================================");
  console.log("  RESTORE TO TEST DATABASE");
  console.log("==================================================");
  console.log(`  Backup folder : ${backupDir}`);
  console.log(`  Collections   : ${files.length}`);
  console.log(`  Real DB       : ${uriDbName || "(unknown)"}   <-- touch aagaadhu`);
  console.log(`  Target (TEST) : ${TEST_DB_NAME}   <-- inga mattum ezhudhum`);
  console.log(`  Reset mode    : ${reset ? "YES (test DB-la irukkura data azhiyum)" : "no"}`);
  console.log("==================================================\n");

  const answer = await ask(`Continue panna "yes" nu type pannu: `);
  if (answer !== "yes") fail("Cancel pannitta. Edhuvum maaralai.");

  /* ----- connect to TEST db ONLY (dbName override) ----- */
  await mongoose.connect(uri, { dbName: TEST_DB_NAME });
  const db = mongoose.connection.db;

  // Marubadi check - nijamave test DB-la dhaan irukkoma
  if (db.databaseName !== TEST_DB_NAME || PROTECTED_DB_NAMES.includes(db.databaseName)) {
    await mongoose.disconnect();
    fail(`Connect aana DB '${db.databaseName}' - expected '${TEST_DB_NAME}'. Stop panniten, edhuvum ezhudhala.`);
  }
  console.log(`\n✅ Connected to: ${db.databaseName} (test)\n`);

  /* ----- test DB-la already data irukka? ----- */
  const existing = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => !n.startsWith("system."));
  let nonEmpty = [];
  for (const n of existing) {
    const c = await db.collection(n).countDocuments({});
    if (c > 0) nonEmpty.push(`${n} (${c})`);
  }

  if (nonEmpty.length > 0 && !reset) {
    await mongoose.disconnect();
    fail(
      `Test DB-la already data irukku:\n   ${nonEmpty.join(", ")}\n\n` +
        `Azhichittu marubadi restore panna --reset serthu run pannu:\n` +
        `   node restore-to-test.js ${backupArg} --reset`
    );
  }

  if (reset) {
    for (const n of existing) {
      await db.collection(n).drop(); // TEST DB mattum (connection ippo test DB)
    }
    if (existing.length) console.log(`🧹 Test DB-la ${existing.length} collections azhichuten (reset)\n`);
  }

  /* ----- restore ----- */
  const results = [];
  for (const file of files) {
    const name = file.replace(/\.json$/, "");
    try {
      const text = fs.readFileSync(path.join(backupDir, file), "utf8");
      const docs = EJSON.parse(text, { relaxed: false });
      if (!Array.isArray(docs)) throw new Error("File format sariyilla");

      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        await db.collection(name).insertMany(docs.slice(i, i + BATCH_SIZE), { ordered: true });
      }

      const inDb = await db.collection(name).countDocuments({});
      const ok = inDb === docs.length;
      results.push({ name, expected: docs.length, inDb, ok });
      console.log(
        `${ok ? "✅" : "⚠️ "} ${name.padEnd(24)} ${String(inDb).padStart(7)} records` +
          (ok ? "" : `   <-- MISMATCH: file-la ${docs.length}, DB-la ${inDb}`)
      );
    } catch (err) {
      results.push({ name, ok: false, error: err.message });
      console.log(`❌ ${name} FAILED: ${err.message}`);
    }
  }

  const allOk = results.every((r) => r.ok);
  const total = results.reduce((s, r) => s + (r.inDb || 0), 0);

  console.log("\n==================================================");
  console.log(allOk ? "🎉 RESTORE SUCCESS - test DB ready" : "⚠️  Sila collections-la problem irukku, mela paaru");
  console.log(`🗄️  Database : ${TEST_DB_NAME}`);
  console.log(`🧾 Total    : ${results.length} collections, ${total} records`);
  console.log("==================================================");
  console.log("\nAdutha step: .env-la MONGO_URI-la database peru-a");
  console.log(`'${TEST_DB_NAME}' nu maathi, backend restart pannu.\n`);

  await mongoose.disconnect();
  process.exit(allOk ? 0 : 2);
}

main().catch(async (err) => {
  console.error("\n❌ RESTORE FAILED:", err.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});