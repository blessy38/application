import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import userRoutes from "./routes/userRoutes.js";
import { connectDB } from "./config/database.js";
import { ensureUserIndexes } from "./models/User.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsPath = path.join(__dirname, "uploads");

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadsPath));

app.use("/api/users", userRoutes);

app.get("/", (req, res) => {
  res.json({ message: "User profile API running" });
});

const startServer = async () => {
  try {
    await connectDB();
    await ensureUserIndexes();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

