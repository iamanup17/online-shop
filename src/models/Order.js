// // models/Order.js
// const mongoose = require("mongoose");

// const orderSchema = new mongoose.Schema(
//   {
//     shopOwner: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     customer: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     items: [
//       {
//         productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
//         qty: Number,
//       },
//     ],
//     deliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // null until picked
//     status: {
//       type: String,
//       enum: ["Pending", "Assigned", "OutForDelivery", "Delivered", "Cancelled"],
//       default: "Pending",
//     },
//     deliveryAssignmentMethod: {
//       type: String,
//       enum: ["self-pick", "manual"],
//       default: "self-pick",
//     },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("Order", orderSchema);

// const mongoose = require("mongoose");

// const orderSchema = new mongoose.Schema(
//   {
//     shopOwner: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     customer: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     items: [
//       {
//         productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
//         qty: Number,
//       },
//     ],
//     deliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//     status: {
//       type: String,
//       enum: ["Pending", "Assigned", "OutForDelivery", "Delivered", "Cancelled"],
//       default: "Pending",
//     },
//     deliveryAssignmentMethod: {
//       type: String,
//       enum: ["self-pick", "manual"],
//       default: "self-pick",
//     },
//     deliveryAddress: {
//       name: String,
//       phone: String,
//       addressLine: String,
//       city: String,
//       pincode: String,
//     },
//     deliveryCharge: { type: Number, default: 0 },
//     deliveryPartnerCommission: { type: Number, default: 0 },
//   },
//   { timestamps: true }
// );

// models/Order.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    shopOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        qty: Number,
      },
    ],
    deliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["Pending", "Assigned", "OutForDelivery", "Delivered", "Cancelled"],
      default: "Pending",
    },
    deliveryAssignmentMethod: {
      type: String,
      enum: ["self-pick", "manual"],
      default: "self-pick",
    },
    deliveryAddress: {
      name: String,
      phone: String,
      addressLine: String,
      city: String,
      pincode: String,
    },
    deliveryCharge: { type: Number, default: 0 },
    deliveryPartnerCommission: { type: Number, default: 0 },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Order", orderSchema);
