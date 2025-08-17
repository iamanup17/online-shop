// // const jwt = require("jsonwebtoken");
// // const User = require("../models/User");

// // const protect = async (req, res, next) => {
// //   let token;
// //   if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
// //     try {
// //       token = req.headers.authorization.split(" ")[1];
// //       const decoded = jwt.verify(token, process.env.JWT_SECRET);
// //       req.user = await User.findById(decoded.id).select("-password");
// //       next();
// //     } catch (err) {
// //       return res.status(401).json({ message: "Not authorized, token failed" });
// //     }
// //   }
// //   if (!token) return res.status(401).json({ message: "No token provided" });
// // };

// // module.exports = protect;

// // ******************************************************

// // const User = require("../models/User");
// // const jwt = require("jsonwebtoken");

// // exports.protect = async (req, res, next) => {
// //   let token;
// //   if (
// //     req.headers.authorization &&
// //     req.headers.authorization.startsWith("Bearer")
// //   ) {
// //     try {
// //       token = req.headers.authorization.split(" ")[1];
// //       const decoded = jwt.verify(token, process.env.JWT_SECRET);
// //       req.user = await User.findById(decoded.id).select("-password");
// //       next();
// //     } catch (err) {
// //       return res.status(401).json({ message: "Not authorized, token failed" });
// //     }
// //   }
// //   if (!token) {
// //     return res.status(401).json({ message: "Not authorized, no token" });
// //   }
// // };

// // exports.shopOwnerOnly = (req, res, next) => {
// //   if (req.user.role !== "shop-owner") {
// //     return res.status(403).json({ message: "Only shop owners allowed" });
// //   }
// //   next();
// // };

// // exports.adminOnly = (req, res, next) => {
// //   if (req.user.role !== "admin") {
// //     return res.status(403).json({ message: "Only admins allowed" });
// //   }
// //   next();
// // };

// // middleware/authMiddleware.js
// const User = require("../models/User");
// const jwt = require("jsonwebtoken");

// exports.protect = async (req, res, next) => {
//   let token;
//   if (
//     req.headers.authorization &&
//     req.headers.authorization.startsWith("Bearer")
//   ) {
//     try {
//       token = req.headers.authorization.split(" ")[1];
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);

//       let user = await User.findById(decoded.id)
//         .populate("shop", "_id name") // so shop is an object
//         .select("-password");

//       // Ensure plain shop id for query filtering
//       if (user?.shop && typeof user.shop === "object") {
//         user.shop = user.shop._id.toString();
//       }

//       req.user = user;
//       next();
//     } catch (err) {
//       return res.status(401).json({ message: "Not authorized, token failed" });
//     }
//   }
//   if (!token) {
//     return res.status(401).json({ message: "Not authorized, no token" });
//   }
// };

// exports.shopOwnerOnly = (req, res, next) => {
//   if (req.user.role !== "shop-owner") {
//     return res.status(403).json({ message: "Only shop owners allowed" });
//   }
//   next();
// };

// exports.adminOnly = (req, res, next) => {
//   if (req.user.role !== "admin") {
//     return res.status(403).json({ message: "Only admins allowed" });
//   }
//   next();
// };

const User = require("../models/User");
const Shop = require("../models/Shop");
const jwt = require("jsonwebtoken");

exports.protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Load user
      const user = await User.findById(decoded.id).select("-password");

      // If shop-owner, find their shop and attach shopId
      if (user.role === "shop-owner") {
        const shop = await Shop.findOne({ owner: user._id }).select("_id");
        user.shop = shop ? shop._id.toString() : null;
      }

      req.user = user;
      return next();
    } catch (err) {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

exports.shopOwnerOnly = (req, res, next) => {
  if (req.user.role !== "shop-owner") {
    return res.status(403).json({ message: "Only shop owners allowed" });
  }
  next();
};

exports.adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admins allowed" });
  }
  next();
};
