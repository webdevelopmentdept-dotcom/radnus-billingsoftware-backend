// routes/storeRoutes.js
// Store Management (Phase 1) - ELLAME ADMIN ONLY.
// Puthu collections mattum touch pannum (stores, cities, storecounters).
// Job sheets / users / engineers-la ethuvum maaradhu.
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Store = require("../models/Store");
const City = require("../models/City");
const StoreCounter = require("../models/StoreCounter");
const { adminOnly } = require("../middleware/roleMiddleware");
const INDIAN_STATES = require("../data/indianStates");
const storeScope = require("../middleware/storeScope")

/* ================= MY STORE (ELLA logged-in users) =================
   Indha user (or admin selected store) entha store-la irukkaanga nu kaattum.
   Frontend-la store name badge-ku, and scope check-ku use aagum.
   NOTE: idhu adminOnly-ku MUNNAADI irukkanum. */
router.get("/mine", storeScope, (req, res) => {
  const s = req.scope;
  res.json({
    all: s.all,
    isMain: s.isMain,
    legacy: !!s.legacy,
    store: s.store
      ? { _id: s.store._id, name: s.store.name, state: s.store.state, city: s.store.city,
          code: s.store.code, active: s.store.active, isDefault: s.store.isDefault }
      : null,
  });
});

router.use(adminOnly);

const CI = { locale: "en", strength: 2 };            // case-insensitive match (regex vendaam)
const clean = (v) => String(v ?? "").trim();
const STORE_CODE_RE = /^[A-Z0-9]{2,8}$/;
const CITY_CODE_RE = /^[A-Z]{2,4}$/;
const cityCodeFrom = (name) => clean(name).replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase();
const bad = (res, message) => res.status(400).json({ message });

/* ================= LIST STORES ================= */
router.get("/", async (req, res) => {
  try {
    const stores = await Store.find()
      .sort({ isDefault: -1, state: 1, city: 1, name: 1 })
      .lean();
    res.json(stores);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= STATES + CITIES (dropdown) ================= */
router.get("/cities", async (req, res) => {
  try {
    const cities = await City.find().sort({ state: 1, name: 1 }).lean();
    res.json({ states: INDIAN_STATES, cities });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= ADD CITY ================= */
router.post("/cities", async (req, res) => {
  try {
    const state = clean(req.body.state);
    const name = clean(req.body.name);
    if (!INDIAN_STATES.includes(state)) return bad(res, "Select a valid state");
    if (!name) return bad(res, "City name required");

    const exists = await City.findOne({ state, name }).collation(CI);
    if (exists) return res.json({ alreadyExists: true, city: exists });

    const code = clean(req.body.code).toUpperCase() || cityCodeFrom(name);
    if (!CITY_CODE_RE.test(code)) return bad(res, "City code must be 2-4 letters");

    const city = await City.create({ state, name, code });
    res.status(201).json({ alreadyExists: false, city });
  } catch (err) {
    if (err.code === 11000) return bad(res, "City already exists");
    res.status(500).json({ message: err.message });
  }
});

/* ================= SUGGEST STORE CODE (PDY01, PDY02 ...) ================= */
router.get("/suggest-code", async (req, res) => {
  try {
    const city = await City.findOne({
      state: clean(req.query.state),
      name: clean(req.query.city),
    }).collation(CI);
    if (!city) return res.status(404).json({ message: "City not found" });

    const prefix = city.code;                                   // letters only (validated)
    const existing = await Store.find({ code: { $regex: `^${prefix}[0-9]+$` } })
      .select("code")
      .lean();
    const used = existing
      .map((s) => parseInt(s.code.slice(prefix.length), 10))
      .filter((n) => !isNaN(n));
    const next = (used.length ? Math.max(...used) : 0) + 1;
    res.json({ code: `${prefix}${String(next).padStart(2, "0")}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= CREATE STORE ================= */
router.post("/", async (req, res) => {
  try {
    const name = clean(req.body.name);
    const state = clean(req.body.state);
    const city = clean(req.body.city);
    const code = clean(req.body.code).toUpperCase();

    if (!name || !state || !city || !code) return bad(res, "Name, state, city and code are required");
    if (!STORE_CODE_RE.test(code)) return bad(res, "Code: 2-8 letters/numbers only (example PDY01)");

    // City master-la irukkanum (spelling consistent-a irukka)
    const cityDoc = await City.findOne({ state, name: city }).collation(CI);
    if (!cityDoc) return bad(res, "Select the city from the list (or add the city first)");

    const store = await Store.create({
      name,
      state: cityDoc.state,
      city: cityDoc.name,
      code,
      active: true,
      isDefault: false,          // Main Store seed script-la mattum create aagum
    });

    try {
      await StoreCounter.create({ storeId: store._id, lastNumber: 0 });
    } catch (e) {
      await Store.findByIdAndDelete(store._id);   // counter illaama store irukkakoodadhu
      throw e;
    }

    storeScope.invalidate();      // puthu store-a Main scope udane therinjukka
    res.status(201).json(store);
  } catch (err) {
    if (err.code === 11000) return bad(res, "Store name or code already exists");
    console.error("STORE CREATE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

/* ================= UPDATE STORE =================
   name / state / city / active mattum maathalam.
   CODE maathakoodaadhu (job numbers-oda link irukku).
   Main Store-a deactivate panna mudiyaadhu. */
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, "Invalid store id");
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ message: "Store not found" });

    const upd = {};

    if (req.body.name !== undefined) {
      const name = clean(req.body.name);
      if (!name) return bad(res, "Store name required");
      upd.name = name;
    }

    if (req.body.state !== undefined || req.body.city !== undefined) {
      const state = clean(req.body.state ?? store.state);
      const city = clean(req.body.city ?? store.city);
      const cityDoc = await City.findOne({ state, name: city }).collation(CI);
      if (!cityDoc) return bad(res, "Select the city from the list (or add the city first)");
      upd.state = cityDoc.state;
      upd.city = cityDoc.name;
    }

    if (req.body.active !== undefined) {
      const active = !!req.body.active;
      if (!active && store.isDefault) return bad(res, "Main Store cannot be deactivated");
      upd.active = active;
    }

    const updated = await Store.findByIdAndUpdate(store._id, { $set: upd }, { new: true });
    res.json(updated);
  } catch (err) {
    if (err.code === 11000) return bad(res, "Store name already exists");
    console.error("STORE UPDATE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// NOTE: DELETE route intentionally illa - store-ku job data link aagum.
// Venaam na "Deactivate" mattum.

module.exports = router;