import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase() {
  await mongoose.connect(env.mongoUri);
  console.log("Connected to MongoDB");
}
