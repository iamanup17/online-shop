// const shopSchema = new mongoose.Schema(
//   {
//     name: { type: String, required: true },
//     address: { type: String, required: true },
//     phone: { type: String },
//     description: { type: String },
//     logo: { type: String }, // store image URL
//     owner: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//       unique: true // one shop per shop-owner
//     },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("Shop", shopSchema);

const mongoose = require("mongoose");
const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String },
    description: { type: String },
    logo: { type: String },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    deliveryCharges: {
      minimumOrderValueForFree: { type: Number, default: 1000 },
      chargeBelowMinimum: { type: Number, default: 15 },
    },
    commissionSettings: {
      fixedCommissionForFreeDelivery: { type: Number, default: 20 },
      commissionPercentForPaidDelivery: { type: Number, default: 50 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Shop", shopSchema);
