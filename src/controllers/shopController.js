const Shop = require("../models/Shop");
const Product = require("../models/Product");

// Shop Owner: create shop
exports.createShop = async (req, res) => {
  try {
    const existing = await Shop.findOne({ owner: req.user._id });
    if (existing) {
      return res.status(400).json({ message: "Shop already exists" });
    }
    const shop = await Shop.create({ ...req.body, owner: req.user._id });
    res.status(201).json(shop);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Shop Owner: update shop
exports.updateShop = async (req, res) => {
  try {
    const shop = await Shop.findOneAndUpdate(
      { owner: req.user._id },
      req.body,
      { new: true }
    );
    res.json(shop);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Shop Owner: get my shop
exports.getMyShop = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });
    if (!shop) {
      return res.status(404).json({ message: "No shop found for this owner" });
    }
    res.json(shop);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Public: get all shops
exports.getAllShops = async (req, res) => {
  try {
    const shops = await Shop.find().populate("owner", "name email");
    res.json(shops);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getShopById = async (req, res) => {
  try {
    // Try to find by Shop _id first
    let shop = await Shop.findById(req.params.id).populate("owner", "name");
    // If not found, try finding by owner (user) id
    if (!shop) {
      shop = await Shop.findOne({ owner: req.params.id }).populate(
        "owner",
        "name"
      );
    }
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // const products = await Product.find({ shopOwner: shop.owner._id });
    const products = await Product.find({ shop: shop._id });

    res.json({ ...shop.toObject(), products });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
