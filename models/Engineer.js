// models/Engineer.js
const mongoose = require("mongoose");

const engineerSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  type: { type: String, enum: ["Hardware", "Software", "Both"], default: "Hardware" }, // NEW
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },   // Phase 2: optional (illa = Main Store)
}, { timestamps: true });

module.exports = mongoose.model("Engineer", engineerSchema);