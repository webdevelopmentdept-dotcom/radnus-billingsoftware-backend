const express = require("express");
const router = express.Router();
const Spare = require("../models/Spare");

// GET — used to populate the searchable dropdown in SparePopup
router.get("/", async (req, res) => {
  const data = await Spare.find().sort({ name: 1 });
  res.json(data);
});

// ADD — called when user types a new spare name and hits "Add"
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Avoid duplicate spares (case-insensitive)
    const existing = await Spare.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
    });
    if (existing) return res.json(existing);

    const newSpare = new Spare({ name: name.trim() });
    await newSpare.save();
    res.json(newSpare);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE
router.put("/:id", async (req, res) => {
  const updated = await Spare.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

// DELETE
router.delete("/:id", async (req, res) => {
  await Spare.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;