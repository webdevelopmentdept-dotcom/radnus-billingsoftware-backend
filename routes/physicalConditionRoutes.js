const express = require("express");
const router = express.Router();
const PhysicalCondition = require("../models/PhysicalCondition");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET all
router.get("/", async (req, res) => {
  const data = await PhysicalCondition.find().sort({ createdAt: -1 });
  res.json(data);
});

// ADD new
router.post("/", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Name required" });

    // fast-path check (avoids duplicates (case-insensitive)
    const existing = await PhysicalCondition.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
    if (existing) return res.json(existing);

    const newItem = new PhysicalCondition({ name });
    await newItem.save();
    res.json(newItem);

  } catch (err) {
    // ✅ NEW — race-condition safety net via the unique index in models/PhysicalCondition.js
    if (err.code === 11000) {
      const winner = await PhysicalCondition.findOne({
        name: new RegExp(`^${escapeRegex((req.body.name || "").trim())}$`, "i")
      });
      return res.json(winner);
    }
    console.error("PhysicalCondition add error:", err);
    res.status(500).json({ message: "Error adding physical condition" });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  await PhysicalCondition.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;