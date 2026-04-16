require("dotenv").config();

const express = require("express");
const path = require("path");
const { sessionMiddleware } = require("./src/auth");
const authRoutes = require("./src/routes/authRoutes");
const leadRoutes = require("./src/routes/leadRoutes");
const discordRoutes = require("./src/routes/discordRoutes");

const PORT = process.env.PORT || 3456;

const app = express();

app.use(express.json());
app.use(sessionMiddleware());
app.use(express.static(path.join(__dirname, "public")));

// API routes
app.use("/api", authRoutes);
app.use("/api", leadRoutes);
app.use("/api", discordRoutes);

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`CRM Dashboard running at http://localhost:${PORT}`);
});
