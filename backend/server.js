
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./db");
const groupRoutes = require("./routes/groups");

const app = express();
const PORT = process.env.PORT || 5000;
const authRoutes = require("./routes/auth");

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "StudentCircle backend is running!"
  });
});

app.use("/api/groups", groupRoutes);

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
