const express = require("express");
const router = express.Router();
const PhysicalCondition = require("../models/PhysicalCondition");

// GET all
router.get("/", async (req, res) => {
  const data = await PhysicalCondition.find().sort({ createdAt: -1 });
  res.json(data);
});

// ADD new
router.post("/", async (req, res) => {
  const { name } = req.body;

  // avoid duplicates (case-insensitive)
  const existing = await PhysicalCondition.findOne({ name: new RegExp(`^${name}$`, "i") });
  if (existing) return res.json(existing);

  const newItem = new PhysicalCondition({ name });
  await newItem.save();
  res.json(newItem);
});

// DELETE
router.delete("/:id", async (req, res) => {
  await PhysicalCondition.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;