const mongoose = require("mongoose");

const accessorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
}, { timestamps: true });

// ✅ NEW — case-insensitive unique index at the DATABASE level. The old app-level
// "findOne then save" check could still let two duplicates through if two requests
// hit the server at almost the same time (double-click, retry, etc). This index makes
// MongoDB itself reject a second matching name outright, no matter how many requests
// race each other.
// ⚠️ Run cleanupDuplicates.js BEFORE deploying this — if duplicate names already exist
// in the collection, MongoDB will refuse to build this index.
accessorySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

module.exports = mongoose.model("Accessory", accessorySchema);