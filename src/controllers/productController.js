const Product = require("../models/Product");
const Shop = require("../models/Shop");
const Category = require("../models/Category"); // ✅ we need this

// Get all products for logged-in shop owner
exports.getMyProducts = async (req, res) => {
  try {
    const products = await Product.find({ shopOwner: req.user._id }).populate(
      "category",
      "name"
    ); // optional: include category name
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// // Create a new product for logged-in shop owner
// exports.createProduct = async (req, res) => {
//   try {
//     // Ensure shop exists
//     const shop = await Shop.findOne({ owner: req.user._id });
//     if (!shop) return res.status(400).json({ message: "No shop found" });

//     // Get and validate fields
//     const { category, name, price, stock } = req.body;

//     // Validate category belongs to this shop owner
//     const categoryExists = await Category.findOne({
//       _id: category,
//       shopOwner: req.user._id,
//     });
//     if (!categoryExists) {
//       return res.status(400).json({ message: "Invalid category" });
//     }

//     // Create product
//     const product = await Product.create({
//       shopOwner: req.user._id,
//       category,
//       name,
//       price,
//       stock,
//     });

//     res.status(201).json(product);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // Update product
// exports.updateProduct = async (req, res) => {
//   try {
//     const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
//       new: true,
//     });
//     res.json(product);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // Delete product
// exports.deleteProduct = async (req, res) => {
//   try {
//     await Product.findByIdAndDelete(req.params.id);
//     res.json({ message: "Product deleted" });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    // Get shop for this owner
    const shop = await Shop.findOne({ owner: req.user._id });
    if (!shop) return res.status(400).json({ message: "No shop found" });

    const { category, name, price, stock } = req.body;

    // Validate category belongs to this shop owner
    const categoryExists = await Category.findOne({
      _id: category,
      shopOwner: req.user._id,
    });
    if (!categoryExists) {
      return res.status(400).json({ message: "Invalid category" });
    }

    // ✅ Include both shopOwner and shop
    const product = await Product.create({
      shop: shop._id, // <-- NEW
      shopOwner: req.user._id, // still keep if used elsewhere
      category,
      name,
      price,
      stock,
    });

    // Notify customers of this shop
    req.io.to(req.user._id.toString()).emit("productsUpdated");

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    // ✅ Emit after update
    req.io.to(req.user._id.toString()).emit("productsUpdated");

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);

    // ✅ Emit after delete
    req.io.to(req.user._id.toString()).emit("productsUpdated");

    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
