const express = require("express");
const { protect, shopOwnerOnly } = require("../middleware/authMiddleware");
const {
  getMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const router = express.Router();

router.use(protect, shopOwnerOnly);

router.get("/my-products", getMyProducts);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;
