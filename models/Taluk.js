// models/Taluk.js
const mongoose = require("mongoose");

const TalukSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  district: { type: String, required: true, trim: true }, // Model.js-la "make" field madhiri
}, { timestamps: true });

// same district-la same taluk name rendu thadava varakoodathu
TalukSchema.index({ name: 1, district: 1 }, { unique: true });

module.exports = mongoose.model("Taluk", TalukSchema);