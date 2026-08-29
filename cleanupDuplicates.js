/* ================= ONE-TIME DUPLICATE CLEANUP SCRIPT =================
   Run once: node cleanupDuplicates.js
   (from inside your backend/ folder, wherever this file sits — same level as server.js
   or inside backend/data like seedDistricts.js — either works, path below is relative
   to THIS file's own folder)

   What it does:
   - For Make / Fault / Accessory / PhysicalCondition: groups documents by name
     (trimmed + lowercased, so "Samsung" and " samsung " count as the same entry).
   - For Model: groups by name + make together (so "iPhone 12" under "Apple" is a
     separate group from "iPhone 12" under a different Make).
   - In each duplicate group, KEEPS the oldest document (first ever created) and
     DELETES the rest.
   - Safe to run because Job Sheets store Make/Model/Fault as plain NAME STRINGS,
     not as a reference (_id) to these master collections — so deleting the extra
     duplicate documents does not affect any existing Job Sheet data.
   - Safe to re-run — if there are no duplicates left, it just logs "0 removed" for
     everything and exits.
*/

const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]); // same fix as server.js — this network's default
                                          // DNS can't resolve MongoDB Atlas's SRV record

const mongoose = require("mongoose");
require("dotenv").config();

// Paths below assume this file sits directly in backend/ (same level as server.js) —
// which is where you've placed it.
const Make = require("./models/Make");
const Model = require("./models/Model");
const Fault = require("./models/Fault");
const Accessory = require("./models/Accessory");
const PhysicalCondition = require("./models/PhysicalCondition");

// Cleans up a simple { name } collection (Make, Fault, Accessory, PhysicalCondition)
async function cleanupByName(Schema, label) {
  const all = await Schema.find().sort({ createdAt: 1 }); // oldest first
  const seen = new Map(); // key: lowercased trimmed name -> kept doc's _id
  const idsToDelete = [];

  for (const doc of all) {
    const key = (doc.name || "").trim().toLowerCase();
    if (!key) continue;

    if (seen.has(key)) {
      idsToDelete.push(doc._id); // duplicate — mark for delete
    } else {
      seen.set(key, doc._id); // first time seeing this name — keep it
    }
  }

  if (idsToDelete.length > 0) {
    await Schema.deleteMany({ _id: { $in: idsToDelete } });
  }

  console.log(`✅ ${label}: ${idsToDelete.length} duplicate(s) removed`);
}

// Cleans up Model separately since duplicates are keyed on (name + make) together
async function cleanupModels() {
  const all = await Model.find().sort({ createdAt: 1 });
  const seen = new Map();
  const idsToDelete = [];

  for (const doc of all) {
    const key = `${(doc.name || "").trim().toLowerCase()}::${(doc.make || "").trim().toLowerCase()}`;
    if (!key.replace("::", "")) continue;

    if (seen.has(key)) {
      idsToDelete.push(doc._id);
    } else {
      seen.set(key, doc._id);
    }
  }

  if (idsToDelete.length > 0) {
    await Model.deleteMany({ _id: { $in: idsToDelete } });
  }

  console.log(`✅ Model: ${idsToDelete.length} duplicate(s) removed`);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("🔌 Connected to MongoDB");

  await cleanupByName(Make, "Make");
  await cleanupModels();
  await cleanupByName(Fault, "Fault");
  await cleanupByName(Accessory, "Accessory");
  await cleanupByName(PhysicalCondition, "PhysicalCondition");

  console.log("🎉 Cleanup done");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});