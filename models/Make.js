const mongoose = require("mongoose");

const makeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
}, { timestamps: true });

// ✅ FIX — the old `unique: true` directly on the field is CASE-SENSITIVE, so "Samsung"
// and "samsung" still counted as different values and both got saved. This named index
// with a collation makes the uniqueness check case-insensitive too.
// ⚠️ Run cleanupDuplicates.js BEFORE deploying this.
makeSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

module.exports = mongoose.model("Make", makeSchema);