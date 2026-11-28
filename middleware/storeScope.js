// middleware/storeScope.js
// Phase 2 - "indha request entha store-oda data-va paarkalam?" nu decide pannum.
//
// protect-ku APRAM run aaganum (req.user venum).  req.scope set pannum:
//   {
//     all      : true  -> ella store (admin, header illaama / "all")
//     storeId  : ObjectId | null  -> scoped store
//     mainId   : ObjectId  -> Main Store id
//     otherIds : [ObjectId] -> Main Store thavira matra ella stores
//     isMain   : true  -> scoped store = Main Store
//     store    : { _id, name, state, city, code, active, isDefault } | null
//     legacy   : true  -> Main Store seed innum run aagala (pazhaya maariye, filter illa)
//   }
//
// Rules:
//   Admin      : X-Store-Id header irundha adhu mattum, illana (or "all") ella store.
//   Matravanga : DB-la irukkura avanga storeId (token/header-a nambaadhu).
//
// MAIN STORE = "vera entha store-kum sondham illaadha ellame".
//   -> storeId illa / null / Main id / theriyaadha pazhaya id (munnaadi revert pannina
//      feature-oda leftover) ellame Main Store. Idhanaala pazhaya data-va maathave vendaam.
const mongoose = require("mongoose");
const Store = require("../models/Store");
const User = require("../models/User");

const toId = (s) => new mongoose.Types.ObjectId(String(s));
const STORE_FIELDS = "name state city code active isDefault";
const TTL = 15 * 1000;

/* ---- Store index: Main id + matra store ids (15s cache; store create aana invalidate) ---- */
let cache = { at: 0, data: null };
async function getStoreIndex() {
  if (cache.data && Date.now() - cache.at < TTL) return cache.data;
  const all = await Store.find().select("_id isDefault").lean();
  const main = all.find((s) => s.isDefault);
  const data = {
    mainId: main ? String(main._id) : null,
    otherIds: all.filter((s) => !s.isDefault).map((s) => String(s._id)),
  };
  cache = { at: Date.now(), data };
  return data;
}

const warned = new Set();

async function storeScope(req, res, next) {
  try {
    const { mainId, otherIds } = await getStoreIndex();

    // Seed run aagala -> ethuvum maaradhu, pazhaya maariye
    if (!mainId) {
      req.scope = { all: true, storeId: null, mainId: null, otherIds: [], isMain: true, store: null, legacy: true };
      return next();
    }

    let all = false;
    let storeDoc = null;

    if (req.user?.role === "admin") {
      const hdr = String(req.headers["x-store-id"] || "").trim();
      if (!hdr || hdr === "all") {
        all = true;
      } else {
        if (!mongoose.isValidObjectId(hdr)) return res.status(400).json({ message: "Invalid store id" });
        storeDoc = await Store.findById(hdr).select(STORE_FIELDS).lean();
        if (!storeDoc) return res.status(404).json({ message: "Store not found" });
      }
    } else {
      const u = await User.findById(req.user?.userId).select("storeId").lean();
      if (!u) return res.status(401).json({ message: "User not found" });

      let sid = u.storeId ? String(u.storeId) : mainId;           // storeId illaama = Main Store
      if (sid !== mainId && !otherIds.includes(sid)) {
        // theriyaadha id = pazhaya (revert pannina) feature-oda leftover -> Main Store
        if (!warned.has(String(u._id))) {
          warned.add(String(u._id));
          console.warn(`[storeScope] user ${u._id} has unknown storeId ${sid} -> treated as Main Store`);
        }
        sid = mainId;
      }
      storeDoc = await Store.findById(sid).select(STORE_FIELDS).lean();
      if (!storeDoc) return res.status(403).json({ message: "Your store was not found. Contact admin." });
      if (!storeDoc.active) return res.status(403).json({ message: "Your store is inactive. Contact admin." });
    }

    const sid = storeDoc ? String(storeDoc._id) : null;
    req.scope = {
      all,
      storeId: sid ? toId(sid) : null,
      mainId: toId(mainId),
      otherIds: otherIds.map(toId),
      isMain: !!sid && sid === mainId,
      store: storeDoc,
    };
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

const need = (req) => {
  if (!req.scope) throw new Error("storeScope middleware route-la podala");   // fail-closed
  return req.scope;
};

/* Puthu store create aana udane call pannu (cache refresh) */
storeScope.invalidate = () => { cache = { at: 0, data: null }; };

/* Mongo condition.
   Main Store = vera entha store-kum sondham illaadha ellame ($nin) */
storeScope.cond = (req, field = "storeId") => {
  const s = need(req);
  if (s.all) return {};
  if (s.isMain) return { [field]: { $nin: s.otherIds } };
  return { [field]: s.storeId };
};

/* Ippo irukkura query-oda scope-a "AND" panni return pannum ($or conflict aagaadhu) */
storeScope.and = (req, query = {}, field = "storeId") => {
  const c = storeScope.cond(req, field);
  return Object.keys(c).length ? { $and: [query, c] } : query;
};

/* Oru record-a (job sheet, user ...) indha request paarkalama? */
storeScope.canAccess = (req, doc) => {
  const s = need(req);
  if (s.all) return true;
  const id = doc && doc.storeId ? String(doc.storeId) : null;
  if (s.isMain) return !id || !s.otherIds.some((o) => String(o) === id);
  return id === String(s.storeId);
};

/* Puthu record create pannum bodhu set panna vendiya storeId (server-la, client value nambaadhu) */
storeScope.stampId = (req) => {
  const s = need(req);
  return (s.all ? s.mainId : s.storeId) || undefined;
};

/* Master data (engineer, drawer, sales rep) create pannum bodhu entha store?
   - Admin: body-la storeId anuppinaa adhu (active store-a irukkanum). Invalid na null return.
   - Matravanga: eppavum avanga store (body value-a nambaadhu) */
storeScope.pickStoreId = async (req, requested) => {
  need(req);
  if (req.user?.role === "admin" && requested) {
    if (!mongoose.isValidObjectId(requested)) return null;
    const st = await Store.findById(requested).select("active").lean();
    if (!st || !st.active) return null;
    return toId(requested);
  }
  return storeScope.stampId(req);
};

module.exports = storeScope;