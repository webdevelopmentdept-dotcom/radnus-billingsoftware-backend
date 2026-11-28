const mongoose = require("mongoose");

const drawerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },   // Phase 2: optional (illa = Main Store)
}, { timestamps: true });

module.exports = mongoose.model("Drawer", drawerSchema);