const mongoose = require("mongoose");

const physicalConditionSchema = new mongoose.Schema({
  name: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("PhysicalCondition", physicalConditionSchema);