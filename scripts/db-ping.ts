import mongoose from "mongoose";
import { connectDB } from "../lib/db";

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Create .env.local from .env.example and add the Atlas connection string.");
    process.exit(1);
  }
  try {
    const conn = await connectDB();
    await conn.connection.db!.admin().ping();
    console.log(`OK — connected to database "${conn.connection.name}"`);
  } catch (err) {
    console.error("DB ping failed:", err instanceof Error ? err.message : err);
    console.error("Check the connection string, DB user, and Atlas Network Access (IP allowlist).");
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main();
