const express = require("express");
const router = express.Router();
const Drawer = require("../models/Drawer");
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
        const doc = await Drawer.findById(id).select("storeId").lean();
    if (doc && !storeScope.canAccess(req, doc)) return res.status(404).json({ message: "Not found" });
    next();
  } catch (err) {
    next(err);
  }
});

// GET
router.get("/", async (req, res) => {
  const data = await Drawer.find(storeScope.cond(req)).sort({ createdAt: -1 });
  res.json(data);
});

// ADD
router.post("/", adminOnly, async (req, res) => {
  const { name } = req.body;

  const storeId = await storeScope.pickStoreId(req, req.body.storeId);   // Phase 2C
  if (storeId === null) return res.status(400).json({ message: "Invalid store" });
  const newDrawer = new Drawer({ name, storeId });
  await newDrawer.save();

  res.json(newDrawer);
});

// UPDATE
router.put("/:id", adminOnly, async (req, res) => {
  const updated = await Drawer.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  res.json(updated);
});

// DELETE
router.delete("/:id", adminOnly, async (req, res) => {
  await Drawer.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;