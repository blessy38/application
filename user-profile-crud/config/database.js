import fs from "fs";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envCandidates = [
  path.resolve(__dirname, "..", ".env"),
  path.resolve(process.cwd(), ".env"),
];

let envLoaded = false;
for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  dotenv.config();
}

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
if (!uri) {
  throw new Error("Missing MONGODB_URI (or DATABASE_URL) in environment variables");
}

export const connectDB = async () => {
  try {
    await mongoose.connect(uri);
    console.log(`Connected to MongoDB Atlas (database: ${mongoose.connection.name})`);
    return mongoose.connection;
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    throw error;
  }
};

export default mongoose;
