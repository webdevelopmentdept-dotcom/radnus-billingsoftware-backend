const express = require("express");
const router = express.Router();
const Accessory = require("../models/Accessory");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET all
router.get("/", async (req, res) => {
  const data = await Accessory.find().sort({ createdAt: -1 });
  res.json(data);
});

// ADD new
router.post("/", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Name required" });

    // fast-path check (case-insensitive)
    const existing = await Accessory.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
    if (existing) {
      // ✅ NEW — tell the caller this was NOT a fresh add, it already existed.
      return res.json({
        ...existing.toObject(),
        alreadyExists: true,
        message: `"${existing.name}" already exists`,
      });
    }

    const newItem = new Accessory({ name });
    await newItem.save();
    res.json({ ...newItem.toObject(), alreadyExists: false });

  } catch (err) {
    // race-condition safety net via the unique index in models/Accessory.js
    if (err.code === 11000) {
      const name = (req.body.name || "").trim();
      const winner = await Accessory.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
      return res.json({
        ...winner.toObject(),
        alreadyExists: true,
        message: `"${winner.name}" already exists`,
      });
    }
    console.error("Accessory add error:", err);
    res.status(500).json({ message: "Error adding accessory" });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  await Accessory.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;