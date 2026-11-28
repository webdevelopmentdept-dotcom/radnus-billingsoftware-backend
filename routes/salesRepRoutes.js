const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { adminOrManager: adminOnly } = require("../middleware/roleMiddleware");   // Phase 2D: admin + storeManager
const storeScope = require("../middleware/storeScope");   // Phase 2C

router.use(storeScope);

/* Phase 2D: store manager-oda store-a maathi vera store-ku anuppa koodaadhu */
router.use((req, res, next) => {
  if (req.user?.role !== "admin" && req.body) delete req.body.storeId;
  next();
});
 
/* Phase 2D: PUT / DELETE :id - vera store record na 404 */
router.param("id", async (req, res, next, id) => {
  try {
    if (!require("mongoose").isValidObjectId(id)) return next();
        const doc = await SalesRep.findById(id).select("storeId").lean();
    if (doc && !storeScope.canAccess(req, doc)) return res.status(404).json({ message: "Not found" });
    next();
  } catch (err) {
    next(err);
  }
});

// ── Inline Schema (separate model file தேவையில்ல) ──
let SalesRep;
try {
  SalesRep = mongoose.model("SalesRep");
} catch {
  SalesRep = mongoose.model("SalesRep", new mongoose.Schema({
    name: { type: String, unique: true, required: true, trim: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
  }, { timestamps: true }));
}

// GET all
router.get("/", async (req, res) => {
  try {
    const reps = await SalesRep.find(storeScope.cond(req)).sort({ name: 1 });
    res.json(reps);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE
router.post("/", adminOnly, async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: "Name required" });
    const storeId = await storeScope.pickStoreId(req, req.body.storeId);   // Phase 2C
    if (storeId === null) return res.status(400).json({ message: "Invalid store" });
    const rep = new SalesRep({ name, storeId });
    await rep.save();
    res.json({ message: "Sales Rep added ✅", rep });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Sales Rep already exists" });
    }
    res.status(500).json({ message: err.message });
  }
});

// DELETE
router.delete("/:id", adminOnly, async (req, res) => {
  try {
    await SalesRep.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted ✅" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;