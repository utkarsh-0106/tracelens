import { Event } from "../models/Event.js";

export function createEventService(EventModel = Event) {
  return {
    createEvent(payload) {
      return EventModel.create(payload);
    },

    async listSessions({ page, limit }) {
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        EventModel.aggregate([
          { $group: {
            _id: "$session_id",
            event_count: { $sum: 1 },
            first_seen: { $min: "$timestamp" },
            last_activity: { $max: "$timestamp" }
          }},
          { $sort: { last_activity: -1 } },
          { $skip: skip },
          { $limit: limit },
          { $project: {
            _id: 0, session_id: "$_id", event_count: 1,
            first_seen: 1, last_activity: 1
          }}
        ]),
        EventModel.distinct("session_id").then((ids) => ids.length)
      ]);
      return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    },

    async listSessionEvents(sessionId) {
      return EventModel.find({ session_id: sessionId }).sort({ timestamp: 1, _id: 1 }).lean();
    },

    async listHeatmapPages() {
      return EventModel.aggregate([
        { $match: { event_type: "click", "coordinates.x": { $exists: true }, "coordinates.y": { $exists: true } } },
        { $group: { _id: "$page_url", click_count: { $sum: 1 } } },
        { $sort: { click_count: -1, _id: 1 } },
        { $project: { _id: 0, page_url: "$_id", click_count: 1 } }
      ]);
    },

    async listHeatmapClicks(pageUrl) {
      return EventModel.find({
        page_url: pageUrl, event_type: "click",
        "coordinates.x": { $exists: true }, "coordinates.y": { $exists: true }
      }).select({ _id: 0, session_id: 1, timestamp: 1, coordinates: 1, viewport: 1, scroll: 1, page_url: 1 }).sort({ timestamp: -1 }).lean();
    }
  };
}

const defaultService = createEventService();
export const createEvent = (...args) => defaultService.createEvent(...args);
export const listSessions = (...args) => defaultService.listSessions(...args);
export const listSessionEvents = (...args) => defaultService.listSessionEvents(...args);
export const listHeatmapPages = (...args) => defaultService.listHeatmapPages(...args);
export const listHeatmapClicks = (...args) => defaultService.listHeatmapClicks(...args);
