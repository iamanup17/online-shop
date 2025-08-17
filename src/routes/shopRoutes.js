const express = require("express");
const { protect, shopOwnerOnly } = require("../middleware/authMiddleware");
const {
  createShop,
  updateShop,
  getMyShop,
  getAllShops,
  getShopById,
} = require("../controllers/shopController");

const router = express.Router();

// ✅ Public route - all shops
router.get("/", getAllShops);

// ✅ Shop Owner route - must be above /:id
router.get("/me", protect, shopOwnerOnly, getMyShop);
router.post("/", protect, shopOwnerOnly, createShop);
router.put("/", protect, shopOwnerOnly, updateShop);

// ✅ Single shop by ID - keep at the end
router.get("/:id", getShopById);

module.exports = router;
