// models/District.js
const mongoose = require("mongoose");

const DistrictSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
}, { timestamps: true });

module.exports = mongoose.model("District", DistrictSchema);