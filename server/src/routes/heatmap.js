import { Router } from "express";
import { z } from "zod";
import { listHeatmapPages, listHeatmapClicks } from "../services/eventService.js";

export function createHeatmapRouter(services = { listHeatmapPages, listHeatmapClicks }) {
  const router = Router();
  router.get("/pages", async (_req, res, next) => {
    try { res.json({ data: await services.listHeatmapPages() }); } catch (error) { next(error); }
  });
  router.get("/clicks", async (req, res, next) => {
    try {
      const parsed = z.string().url().max(2048).safeParse(req.query.pageUrl);
      if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid pageUrl query parameter is required" } });
      res.json({ data: { page_url: parsed.data, clicks: await services.listHeatmapClicks(parsed.data) } });
    } catch (error) { next(error); }
  });
  return router;
}

export default createHeatmapRouter();
