// routes/talukRoutes.js
const express = require("express");
const router = express.Router();
const Taluk = require("../models/Taluk");

// GET taluks for a district
router.get("/:district", async (req, res) => {
  try {
    const taluks = await Taluk.find({ district: req.params.district }).sort({ name: 1 });
    res.json(taluks);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch taluks" });
  }
});

// POST new taluk (needs { name, district })
router.post("/", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const district = (req.body.district || "").trim();
    if (!name || !district) return res.status(400).json({ message: "Taluk name & district required" });

    const existing = await Taluk.findOne({
      name: new RegExp(`^${name}$`, "i"),
      district,
    });
    if (existing) return res.json(existing);

    const taluk = await Taluk.create({ name, district });
    res.status(201).json(taluk);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add taluk" });
  }
});

// talukRoutes.js — add these below the existing GET/POST
router.put("/:id", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Name required" });
    const updated = await Taluk.findByIdAndUpdate(req.params.id, { name }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update taluk" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Taluk.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete taluk" });
  }
});
module.exports = router;