// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const {
  getDeliveryPartners, // Admin
  applyAsDeliveryPartner, // Public applicant
  getShopDeliveryPartners, // Shop-owner list
  updatePartnerStatus, // Shop-owner approves/rejects
  getApprovedDeliveryPartners, // Shop-owner approved only
  getShopOwnerStats,
  getCustomerDashboard,
  getMyProfile,
  addAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
  getMyAddresses,
} = require("../controllers/userController");

const {
  protect,
  shopOwnerOnly,
  adminOnly,
} = require("../middleware/authMiddleware");

// ===== PUBLIC =====
router.post("/delivery/apply", applyAsDeliveryPartner);

// ===== ADMIN =====
router.get("/delivery-partners", protect, adminOnly, getDeliveryPartners);

// ===== SHOP OWNER =====
router.get(
  "/my-delivery-partners",
  protect,
  shopOwnerOnly,
  getShopDeliveryPartners
);
router.put(
  "/delivery-partners/:id/status",
  protect,
  shopOwnerOnly,
  updatePartnerStatus
);
router.get(
  "/approved-partners",
  protect,
  shopOwnerOnly,
  getApprovedDeliveryPartners
);
router.get("/shop-owner/stats", protect, shopOwnerOnly, getShopOwnerStats);

// ===== CUSTOMER =====
router.get("/customer/dashboard", protect, getCustomerDashboard);

router.get("/me", protect, getMyProfile);
router.post("/address", protect, addAddress);
router.put("/address/:id", protect, updateAddress);
router.delete("/address/:id", protect, deleteAddress);
router.patch("/address/:id/default", protect, setDefaultAddress);

router.get("/my-addresses", protect, getMyAddresses);

module.exports = router;
