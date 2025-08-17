// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Please add a name"] },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
    },
    password: { type: String, required: [true, "Please add a password"] },
    role: {
      type: String,
      enum: ["customer", "shop-owner", "delivery", "admin"],
      required: true,
    },
    phone: { type: String },
    vehicleType: { type: String },

    // For shop-owner and delivery partner
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: function () {
        return this.role === "delivery";
      },
    },

    addresses: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        addressLine: { type: String, required: true },
        city: { type: String, required: true },
        pincode: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
      },
    ],

    // For delivery partner application
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: function () {
        return this.role === "delivery" ? "pending" : "approved";
      },
    },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Password match helper
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
