const mongoose = require("mongoose");

const faultSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, default: 0 },
}, { timestamps: true });

// ✅ NEW — case-insensitive unique index on name, same reasoning as Make/Model/Accessory/
// PhysicalCondition. Blocks a second "Screen Crack" (or "screen crack") at the DB level,
// even if two requests race each other.
// ⚠️ Run cleanupDuplicates.js BEFORE deploying this (you already have — good).
faultSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

module.exports = mongoose.model("Fault", faultSchema);