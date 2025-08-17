const User = require("../models/User");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");

// exports.registerUser = async (req, res) => {
//   const { name, email, password, role } = req.body;
//   try {
//     const existingUser = await User.findOne({ email });
//     if (existingUser)
//       return res.status(400).json({ message: "User already exists" });

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const user = await User.create({
//       name,
//       email,
//       password: hashedPassword,
//       role,
//     });

//     res.status(201).json({
//       _id: user.id,
//       name: user.name,
//       email: user.email,
//       role: user.role,
//       token: generateToken(user.id),
//     });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const user = await User.create({
      name,
      email,
      password, // pass plain text — will be hashed by pre("save")
      role,
    });

    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user.id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const user = await User.findOne({ email, role });

    console.log("user", user);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    console.log("plaintext password coming in:", password);
    console.log("hashed password in DB:", user.password);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("bcrypt compare result:", isMatch);

    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user.id),
      status: user.role === "delivery" ? user.status : undefined,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
