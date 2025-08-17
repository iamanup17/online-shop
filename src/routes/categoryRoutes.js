// const express = require("express");
// const { protect } = require("../middleware/authMiddleware"); // ✅ destructure
// const {
//   createCategory,
//   getMyCategories,
//   getCategoriesByShopOwner,
//   getProductsByShopGrouped,
// } = require("../controllers/categoryController");

// const router = express.Router();

// router.use(protect);

// // Shop owner endpoints
// router.post("/", createCategory);
// router.get("/my", getMyCategories);

// // Customer endpoints
// router.get("/shop/:shopOwnerId", getCategoriesByShopOwner);
// router.get("/shop/:shopOwnerId/products", getProductsByShopGrouped);

// module.exports = router;

const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  createCategory,
  getMyCategories,
  getCategoriesByShopOwner,
  getProductsByShopGrouped,
} = require("../controllers/categoryController");

const router = express.Router();

// ✅ Shop owner endpoints (authentication required)
router.post("/", protect, createCategory);
router.get("/my", protect, getMyCategories);

// ✅ Customer endpoints (public access)
router.get("/shop/:shopOwnerId", getCategoriesByShopOwner);
router.get("/shop/:shopOwnerId/products", getProductsByShopGrouped);

module.exports = router;
