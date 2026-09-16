/**
 * fixRevenueEntries.js
 * -----------------------------------------------------------------
 * One-time cleanup for the "stuck stale revenue entry" bug — fixes
 * ONLY the job sheets you list below (not the whole DB).
 *
 * What it does, per listed job sheet:
 *   1. Reads the job's current revenueEntries.
 *   2. Splits them into "prior cycle" (before the last rebill, left
 *      untouched) and "current cycle" (after the last rebill, or all
 *      of them if the job was never rebilled).
 *   3. Sums the current-cycle entries' service/income and compares
 *      that sum to the job's true top-level service.serviceCharge /
 *      service.income.
 *   4. If they don't match (the bug — a stale entry inflating the
 *      sum beyond the real current total), it adjusts the MOST
 *      RECENT current-cycle entry by the difference so the total
 *      lines up exactly. If that entry's amount would go to 0 or
 *      below, it's removed entirely.
 *
 * USAGE:
 *   1. Edit MONGO_URI below (or set it as an env var) and the
 *      JOB_SHEET_NUMBERS array with the exact job sheet numbers to fix
 *      (e.g. ["JS-767", "JS-768"]).
 *   2. DRY RUN (default, safe — prints what WOULD change, writes nothing):
 *        node fixRevenueEntries.js
 *   3. Once you've reviewed the dry-run output and it looks right,
 *      apply for real:
 *        node fixRevenueEntries.js --apply
 * -----------------------------------------------------------------
 */

const mongoose = require("mongoose");

// ✅ FIX — "querySrv ECONNREFUSED" happens when the machine's configured DNS
// resolver doesn't support SRV record lookups (common on some Windows/router
// setups) — the mongodb+srv:// connection string needs an SRV DNS query to
// find the actual cluster hosts. Forcing Node to use Google's public DNS for
// this script's own lookups sidesteps that, without touching any system-wide
// network settings.
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// ✅ EDIT THESE TWO ------------------------------------------------
const MONGO_URI = process.env.MONGO_URI || "PASTE_YOUR_MONGO_URI_HERE";
const JOB_SHEET_NUMBERS = ["JS-767", "JS-768"]; // <-- only these get touched
// -------------------------------------------------------------------

const APPLY = process.argv.includes("--apply");

const JobSheetSchema = new mongoose.Schema({}, { strict: false, collection: "jobsheets" });
const JobSheet = mongoose.model("JobSheet", JobSheetSchema);

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

async function fixOne(jobSheetNo) {
  const job = await JobSheet.findOne({ jobSheetNo });
  if (!job) {
    console.log(`❌ ${jobSheetNo} — not found, skipping`);
    return;
  }

  const service = job.service || {};
  const allEntries = service.revenueEntries || [];
  const rebillHistoryArr = job.rebillHistory || [];
  const lastRebill = rebillHistoryArr.length > 0
    ? rebillHistoryArr[rebillHistoryArr.length - 1]
    : null;
  const cycleStart = lastRebill?.rebilledAt ? new Date(lastRebill.rebilledAt) : null;

  const priorCycleEntries = cycleStart
    ? allEntries.filter((e) => e.date && new Date(e.date) < cycleStart)
    : [];
  const currentCycleEntries = cycleStart
    ? allEntries.filter((e) => e.date && new Date(e.date) >= cycleStart)
    : allEntries.slice();

  const sumService = currentCycleEntries.reduce((s, e) => s + Number(e.service || 0), 0);
  const sumIncome  = currentCycleEntries.reduce((s, e) => s + Number(e.income  || 0), 0);

  const targetService = Number(service.serviceCharge || 0);
  const targetIncome  = Number(service.income || 0);

  const diffService = round2(sumService - targetService); // positive = ledger has EXTRA stuck amount
  const diffIncome  = round2(sumIncome  - targetIncome);

  if (diffService === 0 && diffIncome === 0) {
    console.log(`✅ ${jobSheetNo} — already correct (ledger ${sumService}/${sumIncome} matches ${targetService}/${targetIncome}), no change needed`);
    return;
  }

  console.log(`\n🔧 ${jobSheetNo}`);
  console.log(`   Current-cycle ledger total: service=${sumService}, income=${sumIncome}`);
  console.log(`   True top-level total:       service=${targetService}, income=${targetIncome}`);
  console.log(`   Excess stuck in ledger:     service=${diffService}, income=${diffIncome}`);

  if (currentCycleEntries.length === 0) {
    console.log(`   ⚠️  No current-cycle entries to adjust — skipping (nothing to fix here automatically)`);
    return;
  }

  // adjust the most recent current-cycle entry by the diff (subtract the excess)
  const sorted = [...currentCycleEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const lastEntry = sorted[sorted.length - 1];

  const newLastService = Math.max(0, round2(Number(lastEntry.service || 0) - diffService));
  const newLastIncome  = Math.max(0, round2(Number(lastEntry.income  || 0) - diffIncome));

  console.log(`   Most recent entry (${new Date(lastEntry.date).toISOString().slice(0,10)}): service ${lastEntry.service} → ${newLastService}, income ${lastEntry.income} → ${newLastIncome}`);

  const rebuiltCurrentCycle = sorted.filter((e) => e !== lastEntry);
  if (newLastService > 0 || newLastIncome > 0) {
    rebuiltCurrentCycle.push({
      date: lastEntry.date,
      service: newLastService,
      spare: lastEntry.spare || 0,
      income: newLastIncome,
      others: lastEntry.others || 0,
    });
  } else {
    console.log(`   → most recent entry drops to 0, removing it entirely`);
  }

  const newRevenueEntries = [...priorCycleEntries, ...rebuiltCurrentCycle];

  if (!APPLY) {
    console.log(`   [DRY RUN] Would write ${newRevenueEntries.length} revenueEntries (was ${allEntries.length}). No changes made.`);
    return;
  }

  await JobSheet.updateOne(
    { jobSheetNo },
    { $set: { "service.revenueEntries": newRevenueEntries } }
  );
  console.log(`   ✅ APPLIED — ${jobSheetNo} updated.`);
}

async function main() {
  if (MONGO_URI.includes("PASTE_YOUR")) {
    console.error("❌ Edit MONGO_URI at the top of this script first (or set env var MONGO_URI).");
    process.exit(1);
  }

  console.log(APPLY ? "⚠️  RUNNING IN APPLY MODE — this WILL write to the database.\n" : "🔍 DRY RUN MODE — no changes will be written. Add --apply to actually fix.\n");

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.\n");

  for (const no of JOB_SHEET_NUMBERS) {
    await fixOne(no);
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("SCRIPT ERROR:", err);
  process.exit(1);
});