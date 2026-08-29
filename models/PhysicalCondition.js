const mongoose = require("mongoose");

const physicalConditionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
}, { timestamps: true });

// ✅ NEW — same reasoning as Accessory.js: case-insensitive unique index so MongoDB
// itself blocks a second matching name, even under a race condition.
// ⚠️ Run cleanupDuplicates.js BEFORE deploying this.
physicalConditionSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

module.exports = mongoose.model("PhysicalCondition", physicalConditionSchema);