// check-3a.js — READ-ONLY. Phase 3A-ku munnaadi counter/code sari-a nu paakkum.
// Run: node check-3a.js
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const main = await db.collection("storemaster").findOne({ isDefault: true });
  const counter = main
    ? await db.collection("storecounters").findOne({ storeId: main._id })
    : null;

  const nos = await db.collection("jobsheets").find({}, { projection: { jobSheetNo: 1 } }).toArray();
  let max = 0, nonJS = [];
  for (const j of nos) {
    const s = String(j.jobSheetNo || "");
    const n = parseInt(s.replace(/\D/g, ""), 10);
    if (!isNaN(n) && n > max) max = n;
    if (!/^JS-\d+$/.test(s)) nonJS.push(s);
  }

  console.log("Total jobs              :", nos.length);
  console.log("Highest job number      :", max);
  console.log("Main store              :", main ? `${main.name} (code ${main.code})` : "NOT FOUND");
  console.log("Main counter lastNumber :", counter ? counter.lastNumber : "NOT FOUND");
  console.log("Jobs not in JS-<n> form :", nonJS.length, nonJS.slice(0, 5));

  const ok = main && main.code === "JS" && counter && counter.lastNumber >= max;
  console.log(ok
    ? "\n✅ SAFE — 3A start pannalaam. Next job -> JS-" + (counter.lastNumber + 1)
    : "\n❌ STOP — mela irukkura number-a enakku anuppu, fix panna solren");
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });