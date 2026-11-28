const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  username: { type: String, unique: true },
  password: String,
  role: { type: String, default: "user" },

  feedbackAccess: {
    type: String,
    enum: ["none", "with_billing", "only"],
    default: "none"
  },
  linkedRep: { type: String, default: "" },   // SalesRep name (Service Rep link)
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" }
});

module.exports = mongoose.model("User", userSchema);