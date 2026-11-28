// models/City.js
// State + City master list (Store Management dropdown-ku).
// "code" = store code prefix (Pondicherry -> PDY, Chennai -> CHN).
const mongoose = require("mongoose");

const citySchema = new mongoose.Schema(
  {
    state: { type: String, required: true, trim: true },
    name:  { type: String, required: true, trim: true },
    code:  { type: String, required: true, trim: true, uppercase: true },
  },
  { timestamps: true }
);

// Same state-la "Chennai" / "chennai" rendu thadavai add aagaadhu
citySchema.index(
  { state: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

module.exports = mongoose.model("City", citySchema);