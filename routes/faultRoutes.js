const express = require("express");
const router = express.Router();
const Fault = require("../models/Fault");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET all faults
router.get("/", async (req, res) => {
  const data = await Fault.find().sort({ createdAt: -1 });
  res.json(data);
});

// ADD fault
router.post("/", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const { price } = req.body;
    if (!name) return res.status(400).json({ message: "Fault name required" });

    // fast-path check (case-insensitive)
    const existing = await Fault.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
    if (existing) {
      return res.json({
        ...existing.toObject(),
        alreadyExists: true,
        message: `"${existing.name}" already exists`,
      });
    }

    const newFault = new Fault({ name, price });
    await newFault.save();
    res.json({ ...newFault.toObject(), alreadyExists: false });

  } catch (err) {
    if (err.code === 11000) {
      const name = (req.body.name || "").trim();
      const winner = await Fault.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
      return res.json({
        ...winner.toObject(),
        alreadyExists: true,
        message: `"${winner.name}" already exists`,
      });
    }
    console.error("Fault add error:", err);
    res.status(500).json({ message: "Error adding fault" });
  }
});

// UPDATE fault
router.put("/:id", async (req, res) => {
  const updated = await Fault.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

// DELETE fault
router.delete("/:id", async (req, res) => {
  await Fault.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;