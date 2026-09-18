/**
 * ================= CLEANUP BOGUS revenueEntries (ONE-TIME SCRIPT) =================
 *
 * WHAT THIS FIXES:
 * Before the guard fix in jobSheetController.js, ANY save on a job (even just
 * changing Device Status, Remarks, or Engineer — with Service Charge / Income
 * left completely unchanged) rebuilt revenueEntries as if "today" was a fresh
 * transaction. For an old job that never had revenueEntries before, that
 * silently pushed ONE entry mirroring the job's FULL current serviceCharge +
 * income, dated to whatever day someone happened to click Update/Save Rebill —
 * weeks or months after the job's real repair/delivery date.
 *
 * That single bogus entry is what's leaking these old jobs into "Transaction
 * Date" report ranges that include the day it was created (e.g. Sep 17/18),
 * even though the job's real activity was in May/June.
 *
 * WHAT THIS SCRIPT DOES:
 * Scans every job sheet. For each one, if it has EXACTLY ONE revenueEntries
 * row, AND that row's service+income exactly mirrors the job's current
 * top-level serviceCharge+income (the signature of the bug — a legitimate
 * entry would only coincidentally match this if entered same-day as the job,
 * which the date-gap check below also guards against), AND that row's date
 * is more than 3 days after the job's deliveryDate/repairDate/createdAt
 * (whichever is latest) — it's flagged as bogus and (in --apply mode) its
 * revenueEntries array is cleared back to [].
 *
 * Clearing (not touching serviceCharge/income) is safe: getServiceTotal /
 * getIncomeTotal in every report already fall back to the top-level
 * serviceCharge/income field when revenueEntries is empty — so this reverts
 * the job to *exactly* how it displayed before the bug ever ran. Only its
 * Transaction Date classification changes (falls back to createdAt via
 * jobMatchesDateFilter's own existing fallback), which is the correct fix.
 *
 * Jobs with more than 1 revenueEntries row, or any rebillHistory, are NEVER
 * touched by this script — those are left completely alone since they may
 * be genuine multi-cycle data (like the JS-598 case).
 *
 * HOW TO RUN:
 *   1. Put this file anywhere in your backend project (same place you'd run
 *      other node scripts from — needs access to your existing "models"
 *      folder, since it requires ../models/JobSheet — adjust the require
 *      path below if you place it elsewhere).
 *   2. Set your Mongo connection string as an env var, OR paste it directly
 *      into MONGO_URI below.
 *   3. DRY RUN first (default — makes NO changes, just lists what it would
 *      fix):
 *         node cleanupBogusRevenueEntries.js
 *   4. Review the printed list. If it looks right, actually apply the fix:
 *         node cleanupBogusRevenueEntries.js --apply
 */

// ✅ NEW — loads your existing .env file (same one your backend server.js
// already uses) so MONGO_URI is picked up automatically. This is what was
// missing before: the script never read .env, so MONGO_URI stayed empty and
// fell through to the placeholder text, causing the MongoParseError.
// Run this script from the SAME folder your .env file is in (your cmd
// prompt already shows D:\Radnus-Service\backend>, which is correct).
require("dotenv").config();

const mongoose = require("mongoose");
const dns = require("dns");

// ✅ NEW — fixes "querySrv ECONNREFUSED _mongodb._tcp...mongodb.net". A
// mongodb+srv:// link needs Node to do a DNS "SRV" lookup to find your
// Atlas cluster's real servers. Many ISP/router DNS servers in India don't
// support SRV records properly and just refuse the lookup — switching to
// Google's public DNS resolver here fixes it without touching your .env.
dns.setServers(["8.8.8.8", "8.8.4.4"]);

// Picked up from .env automatically now — no manual editing needed.
const MONGO_URI = process.env.MONGO_URI || "PASTE_YOUR_MONGODB_CONNECTION_STRING_HERE";

// ✅ Adjust this path if this script isn't sitting next to your existing
// "models" folder — it must point at the same JobSheet model your backend uses.
const JobSheet = require("./models/JobSheet");

const APPLY = process.argv.includes("--apply");

// A bogus entry's date has to be more than this many days after the job's
// own real activity (deliveryDate/repairDate/createdAt, whichever is latest)
// to be flagged — this protects any genuine same-day entry from ever matching.
const GAP_DAYS_THRESHOLD = 3;

const daysBetween = (a, b) => Math.abs(new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24);

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.\n");

  const jobs = await JobSheet.find({
    "service.revenueEntries.0": { $exists: true }, // has at least one entry
  });

  console.log(`Scanning ${jobs.length} job sheets that have revenueEntries...\n`);

  const flagged = [];

  for (const job of jobs) {
    const entries = job.service?.revenueEntries || [];
    const rebillHistoryArr = job.rebillHistory || [];

    if (entries.length !== 1) continue;      // only single-entry jobs are candidates
    if (rebillHistoryArr.length > 0) continue; // never touch rebilled jobs

    const entry = entries[0];
    const serviceCharge = Number(job.service?.serviceCharge || 0);
    const income        = Number(job.service?.income        || 0);

    const isMirror =
      Number(entry.service || 0) === serviceCharge &&
      Number(entry.income  || 0) === income;

    if (!isMirror) continue;

    // latest of deliveryDate / repairDate / createdAt — the job's real activity anchor
    const anchorDates = [job.service?.deliveryDate, job.service?.repairDate, job.createdAt]
      .filter(Boolean)
      .map((d) => new Date(d));
    if (anchorDates.length === 0) continue;
    const anchor = new Date(Math.max(...anchorDates.map((d) => d.getTime())));

    const gap = entry.date ? daysBetween(entry.date, anchor) : 0;
    if (gap <= GAP_DAYS_THRESHOLD) continue; // same-day-ish → looks legitimate, skip

    flagged.push({
      jobSheetNo: job.jobSheetNo,
      customer: job.customer?.name || "-",
      serviceCharge,
      income,
      entryDate: entry.date,
      anchorDate: anchor,
      gapDays: Math.round(gap),
      _id: job._id,
    });
  }

  console.log(`Found ${flagged.length} job(s) with a bogus revenueEntries row:\n`);
  flagged.forEach((f) => {
    console.log(
      `  ${f.jobSheetNo}  ${f.customer.padEnd(20)}  service=₹${f.serviceCharge}  income=₹${f.income}  ` +
      `entry dated ${new Date(f.entryDate).toISOString().slice(0, 10)}  ` +
      `(job's real date ${new Date(f.anchorDate).toISOString().slice(0, 10)}, ${f.gapDays} days apart)`
    );
  });

  if (!APPLY) {
    console.log(
      `\nDRY RUN ONLY — no changes made. Review the list above, then re-run with --apply to actually clear these bogus entries.`
    );
  } else {
    console.log(`\nAPPLYING FIX — clearing revenueEntries for ${flagged.length} job(s)...`);
    for (const f of flagged) {
      await JobSheet.updateOne(
        { _id: f._id },
        { $set: { "service.revenueEntries": [] } }
      );
    }
    console.log("Done. These jobs now fall back to their normal top-level serviceCharge/income totals everywhere, exactly as they showed before the bug.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});