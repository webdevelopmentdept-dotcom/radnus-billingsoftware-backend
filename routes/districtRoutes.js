// routes/districtRoutes.js
const express = require("express");
const router = express.Router();
const District = require("../models/District");

// GET all districts
router.get("/", async (req, res) => {
  try {
    const districts = await District.find().sort({ name: 1 });
    res.json(districts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch districts" });
  }
});

// POST new district
router.post("/", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "District name required" });

    const existing = await District.findOne({ name: new RegExp(`^${name}$`, "i") });
    if (existing) return res.json(existing);

    const district = await District.create({ name });
    res.status(201).json(district);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add district" });
  }
});

// districtRoutes.js — add these below the existing GET/POST
router.put("/:id", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Name required" });
    const updated = await District.findByIdAndUpdate(req.params.id, { name }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update district" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const district = await District.findByIdAndDelete(req.params.id);
    if (district) await Taluk.deleteMany({ district: district.name }); // cascade delete its taluks
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete district" });
  }
});
module.exports = router;