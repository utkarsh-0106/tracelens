import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { createEventsRouter } from "./routes/events.js";
import { createSessionsRouter } from "./routes/sessions.js";
import { createHeatmapRouter } from "./routes/heatmap.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import * as eventService from "./services/eventService.js";

export function createApp({ services = eventService } = {}) {
  const app = express();
  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    }
  }));
  app.use(express.json({ limit: "32kb" }));
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ data: { status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" } });
  });
  app.use("/api/events", createEventsRouter(services));
  app.use("/api/sessions", createSessionsRouter(services));
  app.use("/api/heatmap", createHeatmapRouter(services));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
