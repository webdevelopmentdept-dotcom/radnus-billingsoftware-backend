// models/StoreCounter.js
// Ovvoru store-kum job number counter (Phase 3-la use aagum).
// Un DB-la already irukkura "counters" collection-a touch pannaadhu -
// idhu thani collection ("storecounters").
const mongoose = require("mongoose");

const storeCounterSchema = new mongoose.Schema({
  storeId:    { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, unique: true },
  lastNumber: { type: Number, default: 0 },
});

module.exports = mongoose.model("StoreCounter", storeCounterSchema);