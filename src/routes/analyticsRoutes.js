const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { getShopOwnerAnalytics } = require("../controllers/analyticsController");

const router = express.Router();
router.get("/shop-owner", protect, getShopOwnerAnalytics);

module.exports = router;
