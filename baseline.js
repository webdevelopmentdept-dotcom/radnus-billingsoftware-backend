/* =====================================================================
   RADNUS BILLING - BASELINE SNAPSHOT (READ-ONLY)
   ---------------------------------------------------------------------
   Idhu database-a MATTUM PADIKKUM. Edhaiyum write / update / delete
   pannaadhu. (countDocuments, aggregate, find mattum use pannudhu.)

   Use panra vidham (backend folder kulla):
       node baseline.js
           -> ippo irukkura numbers-a backups/baseline-<date>.json la save pannum

       node baseline.js --compare backups/baseline-2026-11-27_10-30.json
           -> ippo irukkura numbers-a antha file-oda ottipaarthu
              ENNA MAARIRUKKU nu kaattum (same na "SAME" nu varum)

   Gate use: Phase 2/3 apram, TEST DB-la (restore-to-test) idha run panni
   --compare panna, ellam SAME nu varanum.
   ===================================================================== */

const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const pad = (n) => String(n).padStart(2, "0");

async function collect(db) {
  const jobs = db.collection("jobsheets");

  const totalJobs = await jobs.countDocuments({});
  const invoiced = await jobs.countDocuments({ isInvoiced: true });
  const cancelled = await jobs.countDocuments({ isCancelled: true });
  const withStoreId = await jobs.countDocuments({ storeId: { $exists: true } });

  const statusRows = await jobs
    .aggregate([{ $group: { _id: "$device.mobileStatus", n: { $sum: 1 } } }])
    .toArray();
  const byStatus = {};
  statusRows.forEach((r) => (byStatus[r._id || "(none)"] = r.n));

  const [sums = {}] = await jobs
    .aggregate([
      {
        $group: {
          _id: null,
          income: { $sum: "$service.income" },
          serviceCharge: { $sum: "$service.serviceCharge" },
          spareCharge: { $sum: "$service.spareCharge" },
          othersAmount: { $sum: "$service.othersAmount" },
          advanceAmount: { $sum: "$service.advanceAmount" },
          balance: { $sum: "$service.balance" },
        },
      },
    ])
    .toArray();

  const [ledger = {}] = await jobs
    .aggregate([
      { $unwind: "$service.revenueEntries" },
      {
        $group: {
          _id: null,
          entries: { $sum: 1 },
          income: { $sum: "$service.revenueEntries.income" },
          service: { $sum: "$service.revenueEntries.service" },
        },
      },
    ])
    .toArray();

  // highest job number (JS-1043 -> 1043)
  const nos = await jobs.find({}, { projection: { jobSheetNo: 1 } }).toArray();
  let maxJobNo = 0;
  let maxJobSheetNo = "";
  for (const j of nos) {
    const n = parseInt(String(j.jobSheetNo || "").replace(/\D/g, ""), 10);
    if (!isNaN(n) && n > maxJobNo) {
      maxJobNo = n;
      maxJobSheetNo = j.jobSheetNo;
    }
  }

  const counts = {};
  for (const c of ["users", "engineers", "salesreps", "drawers", "feedbacks", "feedbackcases"]) {
    counts[c] = await db.collection(c).countDocuments({});
  }

  const round = (x) => Math.round((Number(x) || 0) * 100) / 100;

  return {
    totalJobs,
    invoiced,
    cancelled,
    jobsWithStoreId: withStoreId,
    byStatus,
    sums: {
      income: round(sums.income),
      serviceCharge: round(sums.serviceCharge),
      spareCharge: round(sums.spareCharge),
      othersAmount: round(sums.othersAmount),
      advanceAmount: round(sums.advanceAmount),
      balance: round(sums.balance),
    },
    ledger: {
      entries: ledger.entries || 0,
      income: round(ledger.income),
      service: round(ledger.service),
    },
    maxJobNo,
    maxJobSheetNo,
    counts,
  };
}

// nested object-a "a.b.c" => value nu flat panni compare panna
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function compare(oldSnap, newSnap) {
  // jobsWithStoreId Phase 2 apram maarum, adhu expected - compare-la skip
  const a = flatten(oldSnap);
  const b = flatten(newSnap);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  let diffs = 0;
  for (const k of keys) {
    if (k === "jobsWithStoreId") continue;
    if (a[k] !== b[k]) {
      diffs++;
      console.log(`❌ ${k}: before=${a[k]}  now=${b[k]}`);
    }
  }
  console.log(diffs ? `\n❌ ${diffs} difference(s)` : "\n✅ SAME - ellam match aagudhu");
  return diffs;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log("Connected DB:", db.databaseName, "(read-only)\n");

  const snap = await collect(db);
  console.log(JSON.stringify(snap, null, 2));

  const cmpIdx = process.argv.indexOf("--compare");
  if (cmpIdx !== -1) {
    const file = process.argv[cmpIdx + 1];
    if (!file) throw new Error("--compare-kku file path kudu");
    const old = JSON.parse(fs.readFileSync(file, "utf8"));
    console.log("\n--- Compare with", file, "---");
    const diffs = compare(old.snapshot, snap);
    await mongoose.disconnect();
    process.exit(diffs ? 1 : 0);
  }

  const now = new Date();
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const dir = path.join(__dirname, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `baseline-${stamp}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify({ takenAt: now.toISOString(), database: db.databaseName, snapshot: snap }, null, 2)
  );
  console.log("\n✅ Saved:", out);
  await mongoose.disconnect();
})().catch((e) => {
  console.error("Baseline error:", e.message);
  process.exit(1);
});