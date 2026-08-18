const express = require("express");
const router = express.Router();
const Accessory = require("../models/Accessory");

// GET all
router.get("/", async (req, res) => {
  const data = await Accessory.find().sort({ createdAt: -1 });
  res.json(data);
});

// ADD new
router.post("/", async (req, res) => {
  const { name } = req.body;

  const existing = await Accessory.findOne({ name: new RegExp(`^${name}$`, "i") });
  if (existing) return res.json(existing);

  const newItem = new Accessory({ name });
  await newItem.save();
  res.json(newItem);
});

// DELETE
router.delete("/:id", async (req, res) => {
  await Accessory.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;