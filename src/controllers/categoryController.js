const Category = require("../models/Category");
const Product = require("../models/Product");

// Shop Owner: create category
exports.createCategory = async (req, res) => {
  const { name } = req.body;
  try {
    const exists = await Category.findOne({
      shopOwner: req.user._id,
      name: { $regex: `^${name}$`, $options: "i" },
    });
    if (exists) {
      return res.status(400).json({ message: "Category already exists" });
    }
    const category = await Category.create({
      shopOwner: req.user._id,
      name,
    });
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Shop Owner: get my categories
exports.getMyCategories = async (req, res) => {
  try {
    const categories = await Category.find({ shopOwner: req.user._id });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Customer: get categories for a given shop owner
exports.getCategoriesByShopOwner = async (req, res) => {
  try {
    const categories = await Category.find({ shopOwner: req.params.shopOwnerId });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Customer: get shop products grouped by category
exports.getProductsByShopGrouped = async (req, res) => {
  try {
    const shopOwnerId = req.params.shopOwnerId;
    const categories = await Category.find({ shopOwner: shopOwnerId });
    const grouped = [];

    for (let category of categories) {
      const products = await Product.find({
        shopOwner: shopOwnerId,
        category: category._id,
      });
      grouped.push({
        category: category.name,
        products,
      });
    }

    res.json(grouped);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
