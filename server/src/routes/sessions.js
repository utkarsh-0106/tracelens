import { Router } from "express";
import { z } from "zod";
import { listSessions, listSessionEvents } from "../services/eventService.js";

export function createSessionsRouter(services = { listSessions, listSessionEvents }) {
  const router = Router();
  router.get("/", async (req, res, next) => {
    try {
      const parsed = z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25)
      }).safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid pagination parameters" } });
      res.json({ data: await services.listSessions(parsed.data) });
    } catch (error) { next(error); }
  });
  router.get("/:sessionId/events", async (req, res, next) => {
    try {
      const sessionId = z.string().trim().min(1).max(200).safeParse(req.params.sessionId);
      if (!sessionId.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid session ID" } });
      res.json({ data: { session_id: sessionId.data, events: await services.listSessionEvents(sessionId.data) } });
    } catch (error) { next(error); }
  });
  return router;
}

export default createSessionsRouter();
