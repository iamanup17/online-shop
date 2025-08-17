// controllers/userController.js
const User = require("../models/User");
const Shop = require("../models/Shop");
const Order = require("../models/Order");

// Admin: Get all delivery partners (optional)
exports.getDeliveryPartners = async (req, res) => {
  try {
    const partners = await User.find({ role: "delivery" }).select(
      "_id name email role"
    );
    res.json(partners);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Public: Apply to become delivery partner for a shop
exports.applyAsDeliveryPartner = async (req, res) => {
  try {
    const { name, email, password, phone, shopId, vehicleType } = req.body;
    if (!shopId) return res.status(400).json({ message: "Shop is required" });

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const partner = await User.create({
      name,
      email,
      password, // hashed by model middleware
      phone,
      shop: shopId,
      vehicleType,
      role: "delivery",
      status: "pending",
    });

    // Notify shop owner via socket
    const shop = await Shop.findById(shopId).populate("owner", "_id");
    if (shop && req.io) {
      req.io
        .to(shop.owner._id.toString())
        .emit("newPartnerApplication", partner);
    }

    res.status(201).json({
      message: "Application submitted, awaiting approval",
      partnerId: partner._id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Shop-owner: list their delivery partners
exports.getShopDeliveryPartners = async (req, res) => {
  try {
    const shopId = req.user.shop;
    const partners = await User.find({ role: "delivery", shop: shopId }).select(
      "_id name email phone vehicleType status"
    );
    res.json(partners);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Shop-owner: approve/reject delivery partner
exports.updatePartnerStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const partner = await User.findOneAndUpdate(
      { _id: req.params.id, shop: req.user.shop },
      { status },
      { new: true }
    );
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    req.io.to(partner._id.toString()).emit("partnerStatusUpdated", partner);
    res.json(partner);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Shop-owner: approved delivery partners
exports.getApprovedDeliveryPartners = async (req, res) => {
  try {
    const shopId = req.user.shop;
    if (!shopId)
      return res.status(400).json({ message: "Shop not found on user" });

    const partners = await User.find({
      role: "delivery",
      status: "approved",
      shop: shopId,
    }).select("_id name email phone vehicleType status");

    res.json(partners);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Shop-owner dashboard stats
exports.getShopOwnerStats = async (req, res) => {
  try {
    const shopId = req.user.shop;

    const pendingOrders = await Order.countDocuments({
      shopOwner: req.user._id,
      status: "Pending",
    });
    const assignedOrders = await Order.countDocuments({
      shopOwner: req.user._id,
      status: "Assigned",
    });
    const deliveredOrders = await Order.countDocuments({
      shopOwner: req.user._id,
      status: "Delivered",
    });

    const approvedPartners = await User.countDocuments({
      shop: shopId,
      role: "delivery",
      status: "approved",
    });

    const recentPartners = await User.find({
      shop: shopId,
      role: "delivery",
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email vehicleType createdAt");

    res.json({
      pendingOrders,
      assignedOrders,
      deliveredOrders,
      approvedPartners,
      recentPartners,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Customer dashboard
exports.getCustomerDashboard = async (req, res) => {
  try {
    const recentOrders = await Order.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("shopOwner", "name")
      .populate("deliveryPartner", "name")
      .populate("items.productId", "name price");

    res.json({ recentOrders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("shop", "name") // <--- Add this
      .select("-password"); // Don’t expose password
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const { name, phone, addressLine, city, pincode, isDefault } = req.body;
    const user = await User.findById(req.user._id);

    // If adding as default, unset all previous defaults
    if (isDefault) {
      user.addresses.forEach((address) => (address.isDefault = false));
    }

    user.addresses.push({
      name,
      phone,
      addressLine,
      city,
      pincode,
      isDefault: !!isDefault,
    });

    await user.save();
    res.status(201).json({ addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, addressLine, city, pincode } = req.body;
    const user = await User.findById(req.user._id);

    const address = user.addresses.id(id);
    if (!address) return res.status(404).json({ message: "Address not found" });

    address.name = name;
    address.phone = phone;
    address.addressLine = addressLine;
    address.city = city;
    address.pincode = pincode;

    await user.save();
    res.json({ addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    user.addresses.id(id).remove();
    await user.save();
    res.json({ addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user._id);

    user.addresses.forEach((address) => {
      address.isDefault = address._id.toString() === id;
    });
    await user.save();
    res.json({ addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/users/my-addresses
exports.getMyAddresses = async (req, res) => {
  const user = await User.findById(req.user._id).select("addresses");
  res.json(user.addresses);
};
