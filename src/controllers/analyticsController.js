const Order = require("../models/Order");
const Product = require("../models/Product");

exports.getShopOwnerAnalytics = async (req, res) => {
  try {
    const shopOwnerId = req.user._id;

    // Last 14 days range
    const lastNDays = 14;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - lastNDays);

    // Fetch orders for this shop-owner in last 14 days
    const orders = await Order.find({
      shopOwner: shopOwnerId,
      createdAt: { $gte: sinceDate },
    })
      .populate("items.productId", "name price")
      .lean();

    // Prepare daily stats structure
    let dailyStats = {};
    let topProductsMap = {};

    for (let i = 0; i < lastNDays; i++) {
      const d = new Date(sinceDate);
      d.setDate(sinceDate.getDate() + i);
      const key = d.toISOString().split("T")[0];
      dailyStats[key] = { date: key, orders: 0, revenue: 0 };
    }

    orders.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split("T")[0];
      if (!dailyStats[dateKey]) return;
      dailyStats[dateKey].orders += 1;

      order.items.forEach((item) => {
        const price = item.productId?.price || 0;
        dailyStats[dateKey].revenue += price * (item.qty || 0);

        if (item.productId?.name) {
          topProductsMap[item.productId.name] =
            (topProductsMap[item.productId.name] || 0) + (item.qty || 0);
        }
      });
    });

    const topProducts = Object.entries(topProductsMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    res.json({
      dailyStats: Object.values(dailyStats),
      topProducts,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ message: err.message });
  }
};
