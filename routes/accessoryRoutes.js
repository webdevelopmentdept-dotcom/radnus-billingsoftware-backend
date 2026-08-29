const express = require("express");
const router = express.Router();
const Accessory = require("../models/Accessory");

// Escapes regex special characters in the name so a name like "Ear (Right)" doesn't
// break the RegExp or match unintended things.
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

    // fast-path check (avoids hitting the DB error path on the common case)
    const existing = await Accessory.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
    if (existing) return res.json(existing);

    const newItem = new Accessory({ name });
    await newItem.save();
    res.json(newItem);

  } catch (err) {
    // ✅ NEW — race-condition safety net. If two requests slipped past the check above
    // at the same time, MongoDB's unique index (see models/Accessory.js) rejects the
    // second save with error code 11000. Instead of erroring out, just return whichever
    // document actually made it into the DB.
    if (err.code === 11000) {
      const winner = await Accessory.findOne({
        name: new RegExp(`^${escapeRegex((req.body.name || "").trim())}$`, "i")
      });
      return res.json(winner);
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