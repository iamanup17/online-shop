const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const { baseUrls } = require("./utils/urls");

const allowedOrigin = process.env.FRONTEND_URL || baseUrls.prodUrl;

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// ===== Middleware =====
// app.use(cors());

// ===== Middleware =====
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true, // if you send cookies / auth headers
  })
);

app.use(express.json());
app.use(morgan("dev"));

// ===== Socket.io setup =====
const io = new Server(server, {
  cors: { origin: allowedOrigin }, // In production, replace "*" with allowed frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
});

// Inject io into req for all routes (so controllers can emit events)
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ===== Routes =====
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/shops", require("./routes/shopRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));

// ===== Socket.io Connection Handling =====
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Shop owner joins their shop room to get partner applications / order updates
  socket.on("joinShopRoom", (shopOwnerId) => {
    socket.join(shopOwnerId);
    console.log(`Client joined shop room: ${shopOwnerId}`);
  });

  socket.on("leaveShopRoom", (shopOwnerId) => {
    socket.leave(shopOwnerId);
    console.log(`Client left shop room: ${shopOwnerId}`);
  });

  // ✅ Delivery partner or any logged-in user joins their own room for role-specific real-time events
  socket.on("joinUserRoom", (userId) => {
    socket.join(userId);
    console.log(`Client joined user room: ${userId}`);
  });

  socket.on("leaveUserRoom", (userId) => {
    socket.leave(userId);
    console.log(`Client left user room: ${userId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// ===== Start Server =====
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
