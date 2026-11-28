/* =====================================================================
   RADNUS BILLING - STORE SEED (Phase 1)
   ---------------------------------------------------------------------
   Idhu 3 puthu collection-la mattum ezhudhum: cities, stores, storecounters.
   Un job sheets / users / engineers-la ETHUVUM maathaadhu
   (jobsheets-a PADIKKUM mattum - max job number edukka).

   DEFAULT = DRY RUN (edhaiyum write pannaadhu, enna pannum nu mattum kaattum)

     node seedStores.js            -> dry run (safe)
     node seedStores.js --apply    -> unmaiyaave write pannum

   Enna pannum:
     1. TN + Puducherry cities add pannum (already irundha skip)
     2. "Main Store" (Puducherry / Pondicherry, code JS, isDefault) create pannum
     3. Main Store counter = ippo irukkura max job number (JS-1043 -> 1043)
   Rendu thadavai run pannaalum safe (already irukkaradha dupe pannaadhu).
   ===================================================================== */

const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();
const mongoose = require("mongoose");
mongoose.set("autoIndex", false);   // dry-run-la kooda index/collection create aagakoodadhu

const City = require("./models/City");
const Store = require("./models/Store");
const StoreCounter = require("./models/StoreCounter");

const APPLY = process.argv.includes("--apply");
const CI = { locale: "en", strength: 2 };

const CITIES = {
  "Tamil Nadu": [
    ["Chennai", "CHN"], ["Coimbatore", "CBE"], ["Madurai", "MDU"], ["Tiruchirappalli", "TRY"],
    ["Salem", "SLM"], ["Tirunelveli", "TVL"], ["Erode", "ERD"], ["Vellore", "VLR"],
    ["Tiruppur", "TPR"], ["Thoothukudi", "TUT"], ["Thanjavur", "TNJ"], ["Dindigul", "DGL"],
    ["Cuddalore", "CDL"], ["Kanchipuram", "KPM"], ["Kumbakonam", "KMB"], ["Nagercoil", "NGC"],
    ["Karur", "KRR"], ["Hosur", "HSR"], ["Villupuram", "VPM"], ["Tiruvannamalai", "TVM"],
  ],
  Puducherry: [
    ["Pondicherry", "PDY"], ["Karaikal", "KRK"], ["Mahe", "MAH"], ["Yanam", "YNM"],
  ],
};

const MAIN = { name: "Main Store", state: "Puducherry", city: "Pondicherry", code: "JS" };

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log("Connected DB:", db.databaseName);
  console.log(APPLY ? "MODE: APPLY (writing)\n" : "MODE: DRY RUN (no writes)\n");

  if (APPLY) {
    await Promise.all([City.createIndexes(), Store.createIndexes(), StoreCounter.createIndexes()]);
  }

  /* ---- 1. CITIES ---- */
  let cityAdded = 0, citySkipped = 0;
  for (const [state, list] of Object.entries(CITIES)) {
    for (const [name, code] of list) {
      const exists = await City.findOne({ state, name }).collation(CI).lean();
      if (exists) { citySkipped++; continue; }
      cityAdded++;
      if (APPLY) await City.create({ state, name, code });
    }
  }
  console.log(`Cities : ${cityAdded} ${APPLY ? "added" : "would be added"}, ${citySkipped} already there`);

  /* ---- 2. MAIN STORE ---- */
  let main = await Store.findOne({ isDefault: true });
  if (main) {
    console.log(`Main Store: already exists -> ${main.name} (${main.city}, code ${main.code})`);
  } else {
    console.log(`Main Store: ${APPLY ? "creating" : "would create"} -> ${MAIN.name} (${MAIN.city}, ${MAIN.state}, code ${MAIN.code})`);
    if (APPLY) main = await Store.create({ ...MAIN, active: true, isDefault: true });
  }

  /* ---- 3. MAIN STORE COUNTER (jobsheets READ-ONLY) ---- */
  const nos = await db.collection("jobsheets").find({}, { projection: { jobSheetNo: 1 } }).toArray();
  let maxNo = 0;
  for (const j of nos) {
    const n = parseInt(String(j.jobSheetNo || "").replace(/\D/g, ""), 10);
    if (!isNaN(n) && n > maxNo) maxNo = n;
  }
  console.log(`Job sheets: ${nos.length} found, highest number = ${maxNo}`);

  if (main) {
    const counter = await StoreCounter.findOne({ storeId: main._id });
    if (counter) {
      console.log(`Counter: already exists (lastNumber ${counter.lastNumber})`);
      if (counter.lastNumber < maxNo) {
        console.log(`   WARNING: counter ${counter.lastNumber} < highest job number ${maxNo}. Phase 3-ku munnaadi idha sari pannanum.`);
      }
    } else {
      console.log(`Counter: ${APPLY ? "creating" : "would create"} with lastNumber = ${maxNo}  (next job -> JS-${maxNo + 1})`);
      if (APPLY) await StoreCounter.create({ storeId: main._id, lastNumber: maxNo });
    }
  } else {
    console.log(`Counter: (dry run) would be created with lastNumber = ${maxNo}  (next job -> JS-${maxNo + 1})`);
  }

  console.log(APPLY ? "\nDONE" : "\nDry run mudinjidhu. Ellam sari na: node seedStores.js --apply");
  await mongoose.disconnect();
})().catch((e) => {
  console.error("Seed error:", e.message);
  process.exit(1);
});