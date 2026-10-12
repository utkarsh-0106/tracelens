import dotenv from "dotenv";
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tracelens",
  clientOrigins: (process.env.CLIENT_ORIGINS || "http://localhost:5173,http://localhost:5174")
    .split(",").map((origin) => origin.trim()).filter(Boolean)
};
