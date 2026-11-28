// utils/jobNumber.js
// Phase 3 — store-wise, atomic job numbers.
//   Format : <STORE CODE>-<number, min 4 digits>   e.g. JS-1219 (Main), PDY01-0001
//   Counter: storecounters collection (1 doc per store) -> $inc is atomic,
//            so 2 users saving at the same time can never get the same number.
const Store = require("../models/Store");
const StoreCounter = require("../models/StoreCounter");
const JobSheet = require("../models/JobSheet");

const fmt = (code, n) => `${code}-${String(n).padStart(4, "0")}`;

// Request-oda store (admin ALL = Main Store, matravanga = avanga store)
async function storeForRequest(req) {
  const s = req.scope;
  const id = s && ((s.all ? s.mainId : s.storeId) || null);
  if (!id) return null;                                   // legacy (seed innum run aagala)
  const st = await Store.findById(id).select("code").lean();
  return st ? { storeId: st._id, code: st.code } : null;
}

// Preview mattum (counter-a increase pannaadhu) — form-la kaatta
async function peekNextNumber(req) {
  const st = await storeForRequest(req);
  if (!st) return null;
  const c = await StoreCounter.findOne({ storeId: st.storeId }).select("lastNumber").lean();
  return fmt(st.code, (c ? c.lastNumber : 0) + 1);
}

// Real allocation — save-ku munnaadi. null = legacy mode (caller pazhaya vazhi)
async function allocateJobNumber(req) {
  const st = await storeForRequest(req);
  if (!st) return null;
  for (let i = 0; i < 10; i++) {
    let c;
    try {
      c = await StoreCounter.findOneAndUpdate(
        { storeId: st.storeId },
        { $inc: { lastNumber: 1 } },
        { new: true, upsert: true }
      );
    } catch (e) {
      if (e && e.code === 11000) continue;               // 2 request same-time-la counter create -> retry
      throw e;
    }
    const jobSheetNo = fmt(st.code, c.lastNumber);
    // Counter pinnaadi irundhaalum (manual-insert) — already irukkura number-a skip pannum
    if (await JobSheet.exists({ jobSheetNo })) continue;
    return { jobSheetNo, storeId: st.storeId, n: c.lastNumber };
  }
  throw new Error("Could not allocate a job number, please try again");
}

// Save fail aana number-a thirumba kudukka (gap varaama) — safe: counter innum andha number-la irundha mattum
async function releaseJobNumber(alloc) {
  if (!alloc) return;
  if (await JobSheet.exists({ jobSheetNo: alloc.jobSheetNo })) return;   // save aagiduchu na touch pannaadhu
  await StoreCounter.updateOne({ storeId: alloc.storeId, lastNumber: alloc.n }, { $inc: { lastNumber: -1 } });
}

module.exports = { allocateJobNumber, releaseJobNumber, peekNextNumber, fmt };