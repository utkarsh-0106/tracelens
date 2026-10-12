import { Router } from "express";
import { z } from "zod";
import { createEvent } from "../services/eventService.js";

const coordinatePair = z.object({ x: z.number().finite().nonnegative(), y: z.number().finite().nonnegative() });
const viewport = z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).optional();
const scroll = z.object({ x: z.number().finite().nonnegative(), y: z.number().finite().nonnegative() }).optional();
const eventSchema = z.object({
  session_id: z.string().trim().min(1).max(200),
  event_type: z.enum(["page_view", "click"]),
  page_url: z.string().url().max(2048),
  timestamp: z.coerce.date(),
  coordinates: coordinatePair.optional(),
  viewport,
  scroll
}).superRefine((event, ctx) => {
  if (event.event_type === "click" && !event.coordinates) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["coordinates"], message: "Click events require coordinates" });
  }
});

export function createEventsRouter(services = { createEvent }) {
  const router = Router();
  router.post("/", async (req, res, next) => {
    try {
      const parsed = eventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid event payload", details: parsed.error.flatten() } });
      }
      const event = await services.createEvent(parsed.data);
      return res.status(201).json({ data: { id: event.id ?? event._id, session_id: event.session_id, event_type: event.event_type } });
    } catch (error) { return next(error); }
  });
  return router;
}

export default createEventsRouter();
