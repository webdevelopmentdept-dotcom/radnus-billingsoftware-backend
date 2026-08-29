const mongoose = require("mongoose");

const modelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  make: { type: String, required: true, trim: true } // 🔥 relation
}, { timestamps: true });

// ✅ NEW — case-insensitive unique index on (name + make) TOGETHER, so "iPhone 12"
// under Make "Apple" is blocked from being duplicated, but "iPhone 12" under a
// DIFFERENT make is still allowed (that's a different model, correctly).
// ⚠️ Run cleanupDuplicates.js BEFORE deploying this.
modelSchema.index(
  { name: 1, make: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

module.exports = mongoose.model("Model", modelSchema);