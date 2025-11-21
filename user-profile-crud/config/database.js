import fs from "fs";
import { MongoClient } from "mongodb";
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

const resolveDbNameFromUri = (connectionString) => {
  try {
    const { pathname } = new URL(connectionString);
    if (pathname && pathname !== "/") {
      return decodeURIComponent(pathname.replace(/^\//, ""));
    }
  } catch {
    // ignore invalid URL parse
  }
  return null;
};

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
if (!uri) {
  throw new Error("Missing MONGODB_URI (or DATABASE_URL) in environment variables");
}

const client = new MongoClient(uri);
let database;

export const connectDB = async () => {
  try {
    if (!database) {
      await client.connect();
      const dbName =
        process.env.MONGODB_DB ||
        resolveDbNameFromUri(uri) ||
        undefined;
      database = client.db(dbName);
      console.log(
        `Connected to MongoDB Atlas${dbName ? ` (database: ${dbName})` : ""}`
      );
    }
    return database;
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    throw error;
  }
};

export const getDB = () => {
  if (!database) {
    throw new Error("Database not initialized. Call connectDB() first.");
  }
  return database;
};

