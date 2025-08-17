// orderRoutes.js
const {
  getMyOrders,
  createOrder,
  assignDeliveryPartner,
  markDelivered,
  getAvailableOrders,
  getMyAssignedOrders,
  getMyCustomerOrders,
  getOrdersForShopOwner,
  updateOrderStatus,
  getMyDeliveries,
  markAsDelivered,
  getDeliveredOrders,
  acceptOrder,
  getOrderById,
  getShopOwnerOrderById,
  getDeliveryPartnerOrderById,
  getAvailableOrderById,
  getDeliveryHistoryOrderById,
  getCustomerOrderStats,
  getMyRecentOrders,
} = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware"); // ✅ destructure
const router = require("./authRoutes");

router.use(protect);

// Shop owner
router.get("/", getMyOrders);

// Customer
router.post("/", protect, createOrder);

// Delivery partner
router.get("/available", getAvailableOrders);
router.get("/my-deliveries", getMyAssignedOrders);
router.post("/:id/assign", assignDeliveryPartner);
router.post("/:id/deliver", markDelivered);

router.get("/my-orders", protect, getMyCustomerOrders);
router.get("/shop-orders", protect, getOrdersForShopOwner);

// router.put("/:id/status", protect, updateOrderStatus);
router.put("/:id/status", protect, updateOrderStatus);
router.put("/:id/assign", protect, assignDeliveryPartner);

router.get("/my-deliveries", protect, getMyDeliveries);
router.put("/:id/mark-delivered", protect, markAsDelivered);

router.get("/delivered-history", protect, getDeliveredOrders);

router.get("/my-order-stats", protect, getCustomerOrderStats);

router.get("/my-recent-orders", protect, getMyRecentOrders);

router.put("/:id/accept", protect, acceptOrder);

router.get("/:id", protect, getOrderById);

router.get(
  "/shop-orders/:id",
  protect,
  // getOrdersForShopOwner,
  getShopOwnerOrderById
);

// Delivery partner assigned order details
router.get("/my-deliveries/:id", protect, getDeliveryPartnerOrderById);

// Delivery partner available order details
router.get("/available/:id", protect, getAvailableOrderById);

// Delivery partner delivery history order details
router.get("/delivered-history/:id", protect, getDeliveryHistoryOrderById);

module.exports = router;
