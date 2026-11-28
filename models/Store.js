// models/Store.js
// Ovvoru store/franchise-kum oru record.
// isDefault = true  ->  "Main Store" (ippo irukkura ella data-vum idhuku sondham)
const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true },
    state:     { type: String, required: true, trim: true },
    city:      { type: String, required: true, trim: true },
    code:      { type: String, required: true, trim: true, uppercase: true },
    active:    { type: Boolean, default: true },
        isDefault: { type: Boolean, default: false },
  },
  // NOTE: DB-la "stores" nu pazhaya collection already irukku (vera schema).
  // Adha touch pannaama irukka, idhuku thani collection peru.
  { timestamps: true, collection: "storemaster" }
);

storeSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
storeSchema.index({ code: 1 }, { unique: true });
// Oru Main Store mattum - DB level-lae guarantee
storeSchema.index({ isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

module.exports = mongoose.model("Store", storeSchema);