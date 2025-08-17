// orderController.js
const Order = require("../models/Order");
const Product = require("../models/Product");
const Shop = require("../models/Shop");
const User = require("../models/User");

// Shop owner: get my orders

// Shop owner: get my orders
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ shopOwner: req.user._id })
      .populate("customer", "name email")
      .populate("deliveryPartner", "name")
      .populate("items.productId", "name price");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Shop owner: assign delivery partner
exports.assignDeliveryPartner = async (req, res) => {
  const io = req.app.get("socketio");

  try {
    const { deliveryPartnerId } = req.body;

    // Validate partner is approved & from same shop
    const partner = await User.findOne({
      _id: deliveryPartnerId,
      role: "delivery",
      status: "approved",
      shop: req.user.shop,
    });

    if (!partner) {
      return res.status(400).json({
        message: "Invalid or unapproved delivery partner for your shop",
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { deliveryPartner: partner._id, status: "Assigned" },
      { new: true }
    )
      .populate("customer", "name")
      .populate("shopOwner", "name")
      .populate("deliveryPartner", "name")
      .populate("items.productId", "name price");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Emit events to customer, shop owner, and delivery partner
    req.io.to(order.customer._id.toString()).emit("orderAssigned", order);
    req.io.to(order.shopOwner._id.toString()).emit("orderAssigned", order);
    req.io
      .to(order.deliveryPartner._id.toString())
      .emit("orderAssigned", order);

    // Emit global update for delivery partners' available orders list if needed
    req.io.emit("availableOrdersUpdated");

    res.json(order);
  } catch (err) {
    console.error("assignDeliveryPartner error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.markDelivered = async (req, res) => {
  console.log("This is here");

  try {
    console.log("mark delivered called 2");

    const deliveredOrder = await Order.findOneAndUpdate(
      { _id: req.params.id, deliveryPartner: req.user._id },
      { status: "Delivered" },
      { new: true }
    )
      .populate("customer", "name")
      .populate("shopOwner", "name")
      .populate("deliveryPartner", "name")
      .populate("items.productId", "name price");

    if (!deliveredOrder) {
      console.log("mark delivered called 3");

      return res.status(404).json({ message: "Order not found" });
    }

    console.log(
      "Emitting orderDelivered to customer:",
      deliveredOrder.customer._id
    );

    const deliveredBy = req.user._id.toString();

    // Always notify customer and shop owner
    req.io
      .to(deliveredOrder.customer._id.toString())
      .emit("orderDelivered", deliveredOrder);
    req.io
      .to(deliveredOrder.shopOwner._id.toString())
      .emit("orderDelivered", deliveredOrder);

    if (deliveredBy === deliveredOrder.deliveryPartner?._id.toString()) {
      // Delivery partner marked delivered - shop owner + customer already notified

      console.log("mark delivered called 4");
    } else if (deliveredBy === deliveredOrder.shopOwner._id.toString()) {
      // Shop owner marked delivered - notify delivery partner as well
      if (deliveredOrder.deliveryPartner) {
        console.log("mark delivered called");

        req.io
          .to(deliveredOrder.deliveryPartner._id.toString())
          .emit("orderDelivered", deliveredOrder);
      }
    }

    res.json(deliveredOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delivery partner: available orders
exports.getAvailableOrders = async (req, res) => {
  try {
    const deliveryPartner = await User.findById(req.user._id);
    if (!deliveryPartner || !deliveryPartner.shop) {
      return res
        .status(400)
        .json({ message: "Delivery partner or shop info missing" });
    }

    const orders = await Order.find({
      status: "Pending",
      deliveryPartner: null,
      shop: deliveryPartner.shop,
    })
      .populate("customer", "name")
      .populate("shopOwner", "name")
      .populate("items.productId", "name price")
      .select("+deliveryPartnerCommission");

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delivery partner: my assigned orders
exports.getMyAssignedOrders = async (req, res) => {
  try {
    const orders = await Order.find({ deliveryPartner: req.user._id })
      .populate("customer", "name")
      .populate("shopOwner", "name")
      .populate("items.productId", "name price");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Customer: get my orders
exports.getMyCustomerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate("shopOwner", "name")
      .populate("items.productId", "name price")
      .populate("deliveryPartner", "name")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Customer: create order
exports.createOrder = async (req, res) => {
  try {
    const { items, deliveryAddress } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No items in order" });
    }

    const products = await Product.find({
      _id: { $in: items.map((i) => i.productId) },
    }).populate("shop");

    if (!products.length) {
      return res.status(400).json({ message: "Products not found" });
    }

    const shop = products[0].shop;
    if (!shop) {
      return res.status(400).json({ message: "Shop not found for this order" });
    }

    const shopOwnerId = shop.owner.toString();

    const subtotal = items.reduce((sum, i) => {
      const prod = products.find((p) => p._id.toString() === i.productId);
      return sum + (prod?.price || 0) * i.qty;
    }, 0);

    const deliveryCharge =
      subtotal >= shop.deliveryCharges.minimumOrderValueForFree
        ? 0
        : shop.deliveryCharges.chargeBelowMinimum;

    let commission = 0;
    if (deliveryCharge === 0) {
      commission = shop.commissionSettings.fixedCommissionForFreeDelivery;
    } else {
      commission =
        deliveryCharge *
        (shop.commissionSettings.commissionPercentForPaidDelivery / 100);
    }

    for (let item of items) {
      const prod = products.find((p) => p._id.toString() === item.productId);
      if (prod && prod.stock >= item.qty) {
        prod.stock -= item.qty;
        await prod.save();
      } else {
        return res
          .status(400)
          .json({ message: `Insufficient stock for ${prod?.name}` });
      }
    }

    const order = await Order.create({
      shop: shop._id,
      shopOwner: shopOwnerId,
      customer: req.user._id,
      items,
      deliveryAddress,
      deliveryCharge,
      deliveryPartnerCommission: commission,
      status: "Pending",
    });

    const fullOrder = await Order.findById(order._id)
      .populate("customer", "name")
      .populate("shopOwner", "name")
      .populate("items.productId", "name price");

    if (req.io) {
      // Shop owner room
      req.io.to(shopOwnerId).emit("orderPlaced", fullOrder);

      // Deliver partners belonging to the shop ONLY
      const deliveryPartners = await User.find({
        role: "delivery",
        status: "approved",
        shop: shop._id,
      });

      deliveryPartners.forEach((partner) => {
        req.io.to(partner._id.toString()).emit("orderAvailable", fullOrder);
      });

      req.io.emit("availableOrdersUpdated");

      req.io.to(req.user._id.toString()).emit("orderUpdated", fullOrder);
    }

    res.status(201).json(fullOrder);
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ message: err.message });
  }
};

// Shop-owner: get orders with items
exports.getOrdersForShopOwner = async (req, res) => {
  console.log("Here it is ");
  try {
    const orders = await Order.find({ shopOwner: req.user._id })
      .populate("customer", "name email")
      .populate("deliveryPartner", "name")
      .populate("items.productId", "name price")
      .select("+deliveryCharge +deliveryPartnerCommission")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, deliveryPartnerId } = req.body;
    const updateData = { status };
    if (deliveryPartnerId) {
      updateData.deliveryPartner = deliveryPartnerId;
    }
    const order = await Order.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    })
      .populate("customer", "name")
      .populate("shopOwner", "name")
      .populate("items.productId", "name price");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    req.io.to(order.customer._id.toString()).emit("orderUpdated", order);

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyDeliveries = async (req, res) => {
  try {
    const orders = await Order.find({ deliveryPartner: req.user._id })
      .populate("customer", "name")
      .populate("shopOwner", "name")
      .populate("deliveryPartner", "name")
      .populate("items.productId", "name price")
      .select("+deliveryPartnerCommission");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/orders/my-order-stats
exports.getCustomerOrderStats = async (req, res) => {
  const customerId = req.user._id;
  const allOrders = await Order.find({ customer: customerId });
  const stats = {
    total: allOrders.length,
    delivered: allOrders.filter((o) => o.status === "Delivered").length,
    pending: allOrders.filter((o) => o.status === "Pending").length,
    cancelled: allOrders.filter((o) => o.status === "Cancelled").length,
  };
  res.json(stats);
};

exports.getMyRecentOrders = async (req, res) => {
  const orders = await Order.find({ customer: req.user._id })
    .sort({ createdAt: -1 })
    .limit(5);
  res.json(orders);
};

// Mark a delivery as delivered by delivery partner
exports.markAsDelivered = async (req, res) => {
  console.log("This is here 2");

  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "Delivered" },
      { new: true }
    )
      .populate("customer", "name")
      .populate("shopOwner", "name")
      .populate("items.productId", "name");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Notify relevant users (Shop owner, Customer, Delivery partner)
    req.io.to(order.shopOwner._id.toString()).emit("orderUpdated", order);
    req.io.to(order.customer._id.toString()).emit("orderUpdated", order);
    // req.io.to(order.shopOwner._id.toString()).emit("orderUpdated", order);

    if (order.deliveryPartner) {
      req.io.to(order.deliveryPartner.toString()).emit("orderUpdated", order);
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getDeliveredOrders = async (req, res) => {
  try {
    const delivered = await Order.find({
      deliveryPartner: req.user._id,
      status: "Delivered",
    })
      .populate("customer", "name")
      .populate("shopOwner", "name")
      .populate("items.productId", "name price")
      .select("+deliveryPartnerCommission");
    res.json(delivered);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delivery partner: accept available order (self-pick)
exports.acceptOrder = async (req, res) => {
  console.log("accept order called");

  try {
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "Pending",
        deliveryPartner: null,
      },
      { deliveryPartner: req.user._id, status: "Assigned" },
      { new: true }
    )
      .populate("items.productId", "name")
      .populate("deliveryPartner", "name"); // <--- Add this line

    if (!order) {
      return res.status(400).json({ message: "Order not available" });
    }

    // Notify shop-owner & customer & delivery partner rooms

    req.io.to(order.shopOwner.toString()).emit("orderAssigned", order);
    req.io.to(order.customer.toString()).emit("orderAssigned", order);
    req.io.to(order.deliveryPartner.toString()).emit("orderAssigned", order);

    req.io.to(order.shopOwner.toString()).emit("orderUpdated", order);
    req.io.to(order.customer.toString()).emit("orderUpdated", order);
    req.io.to(order.deliveryPartner.toString()).emit("orderUpdated", order);
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get order by ID with full details
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name email")
      .populate("shopOwner", "name")
      .populate("deliveryPartner", "name phone")
      .populate("items.productId", "name price");

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getShopOwnerOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      shopOwner: req.user._id,
    })
      .populate("customer", "name email")
      .populate("deliveryPartner", "name")
      .populate("items.productId", "name price");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getDeliveryPartnerOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      deliveryPartner: req.user._id,
    })
      .populate("customer", "name")
      .populate("shopOwner", "name")
      .populate("items.productId", "name price");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAvailableOrderById = async (req, res) => {
  try {
    const deliveryPartner = await User.findById(req.user._id);
    if (!deliveryPartner || !deliveryPartner.shop) {
      return res
        .status(400)
        .json({ message: "Delivery partner or shop info missing" });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      status: "Pending",
      deliveryPartner: null,
      shop: deliveryPartner.shop, // Use 'shop' field here
    })
      .populate("customer", "name")
      .populate("shopOwner", "name")
      .populate("items.productId", "name price");

    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getDeliveryHistoryOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      deliveryPartner: req.user._id,
      status: "Delivered",
    })
      .populate("customer", "name")
      .populate("shopOwner", "name")
      .populate("items.productId", "name price");

    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// orderController.js
// const Order = require("../models/Order");
// const Product = require("../models/Product");
// const Shop = require("../models/Shop");
// const User = require("../models/User");

// // Shop owner: get my orders
// // exports.getMyOrders = async (req, res) => {
// //   try {
// //     const orders = await Order.find({ shopOwner: req.user._id })
// //       .populate("customer", "name email")
// //       .populate("deliveryPartner", "name")
// //       .populate("items.productId", "name price"); // ✅ fixed
// //     res.json(orders);
// //   } catch (err) {
// //     res.status(500).json({ message: err.message });
// //   }
// // };

// // Shop owner: get my orders
// exports.getMyOrders = async (req, res) => {
//   try {
//     const orders = await Order.find({ shopOwner: req.user._id })
//       .populate("customer", "name email")
//       .populate("deliveryPartner", "name")
//       .populate("items.productId", "name price");
//     res.json(orders);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // Shop owner: assign delivery partner
// // exports.assignDeliveryPartner = async (req, res) => {
// //   const io = req.app.get("socketio");

// //   try {
// //     const { deliveryPartnerId } = req.body;

// //     // Validate partner is approved & from same shop
// //     const partner = await User.findOne({
// //       _id: deliveryPartnerId,
// //       role: "delivery",
// //       status: "approved",
// //       shop: req.user.shop,
// //     });

// //     if (!partner) {
// //       return res.status(400).json({
// //         message: "Invalid or unapproved delivery partner for your shop",
// //       });
// //     }

// //     const order = await Order.findByIdAndUpdate(
// //       req.params.id,
// //       { deliveryPartner: partner._id, status: "Assigned" },
// //       { new: true }
// //     )
// //       .populate("customer", "name")
// //       .populate("shopOwner", "name")
// //       .populate("deliveryPartner", "name")
// //       .populate("items.productId", "name price"); // ✅ fixed

// //     if (!order) {
// //       return res.status(404).json({ message: "Order not found" });
// //     }

// //     req.io.to(order.customer._id.toString()).emit("orderUpdated", order);
// //     req.io.to(order.shopOwner._id.toString()).emit("orderUpdated", order);

// //     req.io.to(order.customer._id.toString()).emit("orderAssigned", order);
// //     req.io.to(order.shopOwner._id.toString()).emit("orderAssigned", order);
// //     req.io
// //       .to(order.deliveryPartner._id.toString())
// //       .emit("orderAssigned", order);

// //     // io.emit("availableOrdersUpdated");
// //     req.io.emit("availableOrdersUpdated"); // 🔹 fixed here

// //     req.io
// //       .to(order.deliveryPartner._id.toString())
// //       .emit("orderAssigned", order);

// //     res.json(order);
// //   } catch (err) {
// //     console.error("assignDeliveryPartner error:", err);
// //     res.status(500).json({ message: err.message });
// //   }
// // };

// // Shop owner: assign delivery partner
// exports.assignDeliveryPartner = async (req, res) => {
//   const io = req.app.get("socketio");

//   try {
//     const { deliveryPartnerId } = req.body;

//     // Validate partner is approved & from same shop
//     const partner = await User.findOne({
//       _id: deliveryPartnerId,
//       role: "delivery",
//       status: "approved",
//       shop: req.user.shop,
//     });

//     if (!partner) {
//       return res.status(400).json({
//         message: "Invalid or unapproved delivery partner for your shop",
//       });
//     }

//     const order = await Order.findByIdAndUpdate(
//       req.params.id,
//       { deliveryPartner: partner._id, status: "Assigned" },
//       { new: true }
//     )
//       .populate("customer", "name")
//       .populate("shopOwner", "name")
//       .populate("deliveryPartner", "name")
//       .populate("items.productId", "name price");

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     // Emit events to customer, shop owner, and delivery partner
//     req.io.to(order.customer._id.toString()).emit("orderAssigned", order);
//     req.io.to(order.shopOwner._id.toString()).emit("orderAssigned", order);
//     req.io
//       .to(order.deliveryPartner._id.toString())
//       .emit("orderAssigned", order);

//     // Emit global update for delivery partners' available orders list if needed
//     req.io.emit("availableOrdersUpdated");

//     res.json(order);
//   } catch (err) {
//     console.error("assignDeliveryPartner error:", err);
//     res.status(500).json({ message: err.message });
//   }
// };

// // Delivery partner: mark delivered
// // exports.markDelivered = async (req, res) => {
// //   try {
// //     const deliveredOrder = await Order.findOneAndUpdate(
// //       { _id: req.params.id, deliveryPartner: req.user._id },
// //       { status: "Delivered" },
// //       { new: true }
// //     )
// //       .populate("customer", "name")
// //       .populate("shopOwner", "name")
// //       .populate("items.productId", "name price"); // ✅ fixed

// //     const io = req.app.get("socketio");
// //     if (io) io.emit("orderDelivered", deliveredOrder);

// //     const deliveredBy = req.user._id;

// //     // Emit to customer and shop owner always
// //     req.io.to(order.customer._id.toString()).emit("orderDelivered", order);
// //     req.io.to(order.shopOwner._id.toString()).emit("orderDelivered", order);

// //     if (deliveredBy.toString() === order.deliveryPartner?.toString()) {
// //       // Delivery partner marked delivered - notify shop owner and customer only
// //       // Already emitted above, no extra action needed
// //     } else if (deliveredBy.toString() === order.shopOwner.toString()) {
// //       // Shop owner marked delivered - notify delivery partner and customer
// //       if (order.deliveryPartner) {
// //         req.io
// //           .to(order.deliveryPartner.toString())
// //           .emit("orderDelivered", order);
// //       }
// //     }

// //     res.json(deliveredOrder);
// //   } catch (err) {
// //     res.status(500).json({ message: err.message });
// //   }
// // };

// // Delivery partner: mark delivered
// exports.markDelivered = async (req, res) => {
//   try {
//     const deliveredOrder = await Order.findOneAndUpdate(
//       { _id: req.params.id, deliveryPartner: req.user._id },
//       { status: "Delivered" },
//       { new: true }
//     )
//       .populate("customer", "name")
//       .populate("shopOwner", "name")
//       .populate("deliveryPartner", "name")
//       .populate("items.productId", "name price");

//     const io = req.app.get("socketio");

//     if (!deliveredOrder) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     const deliveredBy = req.user._id.toString();

//     // Always notify customer and shop owner
//     req.io
//       .to(deliveredOrder.customer._id.toString())
//       .emit("orderDelivered", deliveredOrder);
//     req.io
//       .to(deliveredOrder.shopOwner._id.toString())
//       .emit("orderDelivered", deliveredOrder);

//     if (deliveredBy === deliveredOrder.deliveryPartner?._id.toString()) {
//       // Delivery partner marked delivered - shop owner + customer already notified
//     } else if (deliveredBy === deliveredOrder.shopOwner._id.toString()) {
//       // Shop owner marked delivered - notify delivery partner as well
//       if (deliveredOrder.deliveryPartner) {
//         req.io
//           .to(deliveredOrder.deliveryPartner._id.toString())
//           .emit("orderDelivered", deliveredOrder);
//       }
//     }

//     res.json(deliveredOrder);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // Delivery partner: available orders

// // exports.getAvailableOrders = async (req, res) => {
// //   try {
// //     const deliveryPartner = await User.findById(req.user._id);
// //     console.log("Delivery Partner:", deliveryPartner);

// //     if (!deliveryPartner || !deliveryPartner.shop) {
// //       console.log("Delivery partner or shop info missing");
// //       return res
// //         .status(400)
// //         .json({ message: "Delivery partner or shop info missing" });
// //     }

// //     console.log("Filtering orders for shop:", deliveryPartner.shop.toString());

// //     // Filter by `shop` instead of `shopOwner`
// //     const orders = await Order.find({
// //       status: "Pending",
// //       deliveryPartner: null,
// //       shop: deliveryPartner.shop,
// //     })
// //       .populate("customer", "name")
// //       .populate("shopOwner", "name")
// //       .populate("items.productId", "name price")
// //       .select("+deliveryPartnerCommission");

// //     console.log("Orders found:", orders.length);

// //     res.json(orders);
// //   } catch (err) {
// //     console.error("getAvailableOrders error:", err);
// //     res.status(500).json({ message: err.message });
// //   }
// // };

// // Delivery partner: available orders
// exports.getAvailableOrders = async (req, res) => {
//   try {
//     const deliveryPartner = await User.findById(req.user._id);
//     if (!deliveryPartner || !deliveryPartner.shop) {
//       return res
//         .status(400)
//         .json({ message: "Delivery partner or shop info missing" });
//     }

//     const orders = await Order.find({
//       status: "Pending",
//       deliveryPartner: null,
//       shop: deliveryPartner.shop,
//     })
//       .populate("customer", "name")
//       .populate("shopOwner", "name")
//       .populate("items.productId", "name price")
//       .select("+deliveryPartnerCommission");

//     res.json(orders);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // Delivery partner: my assigned orders
// // exports.getMyAssignedOrders = async (req, res) => {
// //   try {
// //     const orders = await Order.find({ deliveryPartner: req.user._id })
// //       .populate("customer", "name")
// //       .populate("shopOwner", "name")
// //       .populate("items.productId", "name price"); // ✅ fixed
// //     res.json(orders);
// //   } catch (err) {
// //     res.status(500).json({ message: err.message });
// //   }
// // };

// // Delivery partner: my assigned orders
// exports.getMyAssignedOrders = async (req, res) => {
//   try {
//     const orders = await Order.find({ deliveryPartner: req.user._id })
//       .populate("customer", "name")
//       .populate("shopOwner", "name")
//       .populate("items.productId", "name price");
//     res.json(orders);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // Customer: get my orders
// // exports.getMyCustomerOrders = async (req, res) => {
// //   try {
// //     const orders = await Order.find({ customer: req.user._id })
// //       .populate("shopOwner", "name")
// //       .populate("items.productId", "name price") // ✅ fixed
// //       .populate("deliveryPartner", "name") // ✅ populate delivery partner name

// //       .sort({ createdAt: -1 });
// //     res.json(orders);
// //   } catch (err) {
// //     res.status(500).json({ message: err.message });
// //   }
// // };

// // Customer: get my orders
// exports.getMyCustomerOrders = async (req, res) => {
//   try {
//     const orders = await Order.find({ customer: req.user._id })
//       .populate("shopOwner", "name")
//       .populate("items.productId", "name price")
//       .populate("deliveryPartner", "name")
//       .sort({ createdAt: -1 });
//     res.json(orders);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // Customer: create order
// // exports.createOrder = async (req, res) => {
// //   try {
// //     const { items, deliveryAddress } = req.body;

// //     // 1. Validate cart items
// //     if (!items || items.length === 0) {
// //       return res.status(400).json({ message: "No items in order" });
// //     }

// //     // 2. Get products with shop populated
// //     const products = await Product.find({
// //       _id: { $in: items.map((i) => i.productId) },
// //     }).populate("shop");

// //     if (!products.length) {
// //       return res.status(400).json({ message: "Products not found" });
// //     }

// //     // 3. Get shop info from first product
// //     const shop = products[0].shop;
// //     if (!shop) {
// //       return res.status(400).json({ message: "Shop not found for this order" });
// //     }

// //     const shopOwnerId = shop.owner.toString(); // ✅ now properly defined

// //     // 4. Calculate subtotal
// //     const subtotal = items.reduce((sum, i) => {
// //       const prod = products.find((p) => p._id.toString() === i.productId);
// //       return sum + (prod?.price || 0) * i.qty;
// //     }, 0);

// //     // 5. Calculate delivery charge
// //     const deliveryCharge =
// //       subtotal >= shop.deliveryCharges.minimumOrderValueForFree
// //         ? 0
// //         : shop.deliveryCharges.chargeBelowMinimum;

// //     // 6. Calculate commission
// //     let commission = 0;
// //     if (deliveryCharge === 0) {
// //       commission = shop.commissionSettings.fixedCommissionForFreeDelivery;
// //     } else {
// //       commission =
// //         deliveryCharge *
// //         (shop.commissionSettings.commissionPercentForPaidDelivery / 100);
// //     }

// //     // 7. Deduct product stock
// //     for (let item of items) {
// //       const prod = products.find((p) => p._id.toString() === item.productId);
// //       if (prod && prod.stock >= item.qty) {
// //         prod.stock -= item.qty;
// //         await prod.save();
// //       } else {
// //         return res
// //           .status(400)
// //           .json({ message: `Insufficient stock for ${prod?.name}` });
// //       }
// //     }

// //     // 8. Create the order
// //     const order = await Order.create({
// //       shop: shop._id,
// //       shopOwner: shopOwnerId,
// //       customer: req.user._id,
// //       items,
// //       deliveryAddress,
// //       deliveryCharge,
// //       deliveryPartnerCommission: commission,
// //       status: "Pending",
// //     });

// //     // 9. Populate order for response & sockets
// //     const fullOrder = await Order.findById(order._id)
// //       .populate("customer", "name")
// //       .populate("shopOwner", "name")
// //       .populate("items.productId", "name price");

// //     // 10. Emit socket events to all relevant parties
// //     // after creating and populating fullOrder
// //     if (req.io) {
// //       // Shop owner room
// //       req.io.to(shopOwnerId).emit("orderPlaced", fullOrder);

// //       // Deliver partners belonging to the shop ONLY - emit to their rooms individually
// //       const deliveryPartners = await User.find({
// //         role: "delivery",
// //         status: "approved",
// //         shop: shop._id,
// //       });

// //       deliveryPartners.forEach((partner) => {
// //         req.io.to(partner._id.toString()).emit("orderAvailable", fullOrder);
// //       });

// //       // Optionally notify all delivery partners globally (if needed)
// //       req.io.emit("availableOrdersUpdated");

// //       // Notify customer room
// //       req.io.to(req.user._id.toString()).emit("orderUpdated", fullOrder);
// //     }

// //     // 11. Respond to API caller
// //     res.status(201).json(fullOrder);
// //   } catch (err) {
// //     console.error("Error creating order:", err);
// //     res.status(500).json({ message: err.message });
// //   }
// // };

// // Customer: create order
// exports.createOrder = async (req, res) => {
//   try {
//     const { items, deliveryAddress } = req.body;

//     if (!items || items.length === 0) {
//       return res.status(400).json({ message: "No items in order" });
//     }

//     const products = await Product.find({
//       _id: { $in: items.map((i) => i.productId) },
//     }).populate("shop");

//     if (!products.length) {
//       return res.status(400).json({ message: "Products not found" });
//     }

//     const shop = products[0].shop;
//     if (!shop) {
//       return res.status(400).json({ message: "Shop not found for this order" });
//     }

//     const shopOwnerId = shop.owner.toString();

//     const subtotal = items.reduce((sum, i) => {
//       const prod = products.find((p) => p._id.toString() === i.productId);
//       return sum + (prod?.price || 0) * i.qty;
//     }, 0);

//     const deliveryCharge =
//       subtotal >= shop.deliveryCharges.minimumOrderValueForFree
//         ? 0
//         : shop.deliveryCharges.chargeBelowMinimum;

//     let commission = 0;
//     if (deliveryCharge === 0) {
//       commission = shop.commissionSettings.fixedCommissionForFreeDelivery;
//     } else {
//       commission =
//         deliveryCharge *
//         (shop.commissionSettings.commissionPercentForPaidDelivery / 100);
//     }

//     for (let item of items) {
//       const prod = products.find((p) => p._id.toString() === item.productId);
//       if (prod && prod.stock >= item.qty) {
//         prod.stock -= item.qty;
//         await prod.save();
//       } else {
//         return res
//           .status(400)
//           .json({ message: `Insufficient stock for ${prod?.name}` });
//       }
//     }

//     const order = await Order.create({
//       shop: shop._id,
//       shopOwner: shopOwnerId,
//       customer: req.user._id,
//       items,
//       deliveryAddress,
//       deliveryCharge,
//       deliveryPartnerCommission: commission,
//       status: "Pending",
//     });

//     const fullOrder = await Order.findById(order._id)
//       .populate("customer", "name")
//       .populate("shopOwner", "name")
//       .populate("items.productId", "name price");

//     if (req.io) {
//       // Shop owner room
//       req.io.to(shopOwnerId).emit("orderPlaced", fullOrder);

//       // Deliver partners belonging to the shop ONLY
//       const deliveryPartners = await User.find({
//         role: "delivery",
//         status: "approved",
//         shop: shop._id,
//       });

//       deliveryPartners.forEach((partner) => {
//         req.io.to(partner._id.toString()).emit("orderAvailable", fullOrder);
//       });

//       req.io.emit("availableOrdersUpdated");

//       req.io.to(req.user._id.toString()).emit("orderUpdated", fullOrder);
//     }

//     res.status(201).json(fullOrder);
//   } catch (err) {
//     console.error("Error creating order:", err);
//     res.status(500).json({ message: err.message });
//   }
// };

// // Shop-owner: get orders with items
// // exports.getOrdersForShopOwner = async (req, res) => {
// //   try {
// //     const orders = await Order.find({ shopOwner: req.user._id })
// //       // .populate("customer", "name")
// //       // .populate("items.productId", "name price") // ✅ fixed
// //       // .sort({ createdAt: -1 });

// //       .populate("customer", "name email")
// //       .populate("deliveryPartner", "name") // ✅ so partner name is available
// //       .populate("items.productId", "name price")
// //       .select("+deliveryCharge +deliveryPartnerCommission")

// //       .sort({ createdAt: -1 }); // ✅ amounts

// //     res.json(orders);
// //   } catch (err) {
// //     res.status(500).json({ message: err.message });
// //   }
// // };

// // Shop-owner: get orders with items
// exports.getOrdersForShopOwner = async (req, res) => {
//   try {
//     const orders = await Order.find({ shopOwner: req.user._id })
//       .populate("customer", "name email")
//       .populate("deliveryPartner", "name")
//       .populate("items.productId", "name price")
//       .select("+deliveryCharge +deliveryPartnerCommission")
//       .sort({ createdAt: -1 });
//     res.json(orders);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // Update order status
// // exports.updateOrderStatus = async (req, res) => {
// //   try {
// //     const { status, deliveryPartnerId } = req.body;

// //     const updateData = { status };
// //     if (deliveryPartnerId) {
// //       updateData.deliveryPartner = deliveryPartnerId;
// //     }

// //     const order = await Order.findByIdAndUpdate(req.params.id, updateData, {
// //       new: true,
// //     })
// //       .populate("customer", "name")
// //       .populate("shopOwner", "name")
// //       .populate("items.productId", "name price"); // ✅ fixed

// //     if (!order) {
// //       return res.status(404).json({ message: "Order not found" });
// //     }

// //     req.io.to(order.customer._id.toString()).emit("orderUpdated", order);

// //     res.json(order);
// //   } catch (err) {
// //     res.status(500).json({ message: err.message });
// //   }
// // };

// // Update order status
// exports.updateOrderStatus = async (req, res) => {
//   try {
//     const { status, deliveryPartnerId } = req.body;
//     const updateData = { status };
//     if (deliveryPartnerId) {
//       updateData.deliveryPartner = deliveryPartnerId;
//     }
//     const order = await Order.findByIdAndUpdate(req.params.id, updateData, {
//       new: true,
//     })
//       .populate("customer", "name")
//       .populate("shopOwner", "name")
//       .populate("items.productId", "name price");

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     req.io.to(order.customer._id.toString()).emit("orderUpdated", order);

//     res.json(order);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.getMyDeliveries = async (req, res) => {
//   try {
//     const orders = await Order.find({ deliveryPartner: req.user._id })
//       .populate("customer", "name")
//       .populate("shopOwner", "name")
//       .populate("deliveryPartner", "name")
//       .populate("items.productId", "name price")
//       .select("+deliveryPartnerCommission");
//     res.json(orders);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // Mark a delivery as delivered by delivery partner
// exports.markAsDelivered = async (req, res) => {
//   try {
//     const order = await Order.findByIdAndUpdate(
//       req.params.id,
//       { status: "Delivered" },
//       { new: true }
//     )
//       .populate("customer", "name")
//       .populate("shopOwner", "name")
//       .populate("items.productId", "name");

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     // Notify relevant users (Shop owner, Customer, Delivery partner)
//     req.io.to(order.shopOwner._id.toString()).emit("orderUpdated", order);
//     req.io.to(order.customer._id.toString()).emit("orderUpdated", order);
//     // req.io.to(order.shopOwner._id.toString()).emit("orderUpdated", order);

//     if (order.deliveryPartner) {
//       req.io.to(order.deliveryPartner.toString()).emit("orderUpdated", order);
//     }

//     res.json(order);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.getDeliveredOrders = async (req, res) => {
//   try {
//     const delivered = await Order.find({
//       deliveryPartner: req.user._id,
//       status: "Delivered",
//     })
//       .populate("customer", "name")
//       .populate("shopOwner", "name")
//       .populate("items.productId", "name price")
//       .select("+deliveryPartnerCommission");
//     res.json(delivered);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // Delivery partner: accept available order (self-pick)
// // exports.acceptOrder = async (req, res) => {
// //   try {
// //     const order = await Order.findOneAndUpdate(
// //       {
// //         _id: req.params.id,
// //         status: "Pending",
// //         deliveryPartner: null,
// //       },
// //       { deliveryPartner: req.user._id, status: "Assigned" },
// //       { new: true }
// //     ).populate("items.productId", "name");

// //     if (!order) {
// //       return res.status(400).json({ message: "Order not available" });
// //     }

// //     // Notify shop-owner & customer
// req.io.to(order.shopOwner.toString()).emit("orderUpdated", order);
// req.io.to(order.customer.toString()).emit("orderUpdated", order);

// //     req.io.to(order.shopOwner.toString()).emit("orderAssigned", order);
// //     req.io.to(order.customer.toString()).emit("orderAssigned", order);
// //     req.io.to(order.deliveryPartner.toString()).emit("orderAssigned", order);

// //     // req.io.to(order.shopOwner.toString()).emit("orderUpdated", order);
// //     // req.io.to(order.customer.toString()).emit("orderUpdated", order);

// //     res.json(order);
// //   } catch (err) {
// //     res.status(500).json({ message: err.message });
// //   }
// // };

// // Delivery partner: accept available order (self-pick)
// exports.acceptOrder = async (req, res) => {
//   try {
//     const order = await Order.findOneAndUpdate(
//       {
//         _id: req.params.id,
//         status: "Pending",
//         deliveryPartner: null,
//       },
//       { deliveryPartner: req.user._id, status: "Assigned" },
//       { new: true }
//     ).populate("items.productId", "name");

//     if (!order) {
//       return res.status(400).json({ message: "Order not available" });
//     }

//     // Notify shop-owner & customer & delivery partner rooms
//     req.io.to(order.shopOwner.toString()).emit("orderAssigned", order);
//     req.io.to(order.customer.toString()).emit("orderAssigned", order);
//     req.io.to(order.deliveryPartner.toString()).emit("orderAssigned", order);

//     res.json(order);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // Get order by ID with full details
// exports.getOrderById = async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id)
//       .populate("customer", "name email")
//       .populate("shopOwner", "name")
//       .populate("deliveryPartner", "name")
//       .populate("items.productId", "name price");

//     if (!order) return res.status(404).json({ message: "Order not found" });

//     res.json(order);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.getShopOwnerOrderById = async (req, res) => {
//   try {
//     const order = await Order.findOne({
//       _id: req.params.id,
//       shopOwner: req.user._id,
//     })
//       .populate("customer", "name email")
//       .populate("deliveryPartner", "name")
//       .populate("items.productId", "name price");
//     if (!order) return res.status(404).json({ message: "Order not found" });
//     res.json(order);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.getDeliveryPartnerOrderById = async (req, res) => {
//   try {
//     const order = await Order.findOne({
//       _id: req.params.id,
//       deliveryPartner: req.user._id,
//     })
//       .populate("customer", "name")
//       .populate("shopOwner", "name")
//       .populate("items.productId", "name price");
//     if (!order) return res.status(404).json({ message: "Order not found" });
//     res.json(order);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.getAvailableOrderById = async (req, res) => {
//   try {
//     const deliveryPartner = await User.findById(req.user._id);
//     if (!deliveryPartner || !deliveryPartner.shop) {
//       return res
//         .status(400)
//         .json({ message: "Delivery partner or shop info missing" });
//     }

//     const order = await Order.findOne({
//       _id: req.params.id,
//       status: "Pending",
//       deliveryPartner: null,
//       shop: deliveryPartner.shop, // Use 'shop' field here
//     })
//       .populate("customer", "name")
//       .populate("shopOwner", "name")
//       .populate("items.productId", "name price");

//     if (!order) return res.status(404).json({ message: "Order not found" });
//     res.json(order);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.getDeliveryHistoryOrderById = async (req, res) => {
//   try {
//     const order = await Order.findOne({
//       _id: req.params.id,
//       deliveryPartner: req.user._id,
//       status: "Delivered",
//     })
//       .populate("customer", "name")
//       .populate("shopOwner", "name")
//       .populate("items.productId", "name price");

//     if (!order) return res.status(404).json({ message: "Order not found" });
//     res.json(order);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };
