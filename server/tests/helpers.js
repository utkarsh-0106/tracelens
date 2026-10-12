import http from "node:http";
import { createApp } from "../src/app.js";

export function createMemoryServices() {
  const events = [];
  let nextId = 1;

  return {
    events,
    services: {
      async createEvent(payload) {
        const id = String(nextId++);
        const event = { ...structuredClone(payload), _id: id, id };
        events.push(event);
        return event;
      },
      async listSessions({ page, limit }) {
        const grouped = new Map();
        for (const event of events) {
          const current = grouped.get(event.session_id);
          const timestamp = new Date(event.timestamp);
          if (!current) {
            grouped.set(event.session_id, {
              session_id: event.session_id, event_count: 1,
              first_seen: timestamp, last_activity: timestamp
            });
          } else {
            current.event_count += 1;
            if (timestamp < current.first_seen) current.first_seen = timestamp;
            if (timestamp > current.last_activity) current.last_activity = timestamp;
          }
        }
        const all = [...grouped.values()].sort((a, b) => b.last_activity - a.last_activity);
        const skip = (page - 1) * limit;
        return {
          items: all.slice(skip, skip + limit),
          pagination: { page, limit, total: all.length, pages: Math.ceil(all.length / limit) }
        };
      },
      async listSessionEvents(sessionId) {
        return events.filter((event) => event.session_id === sessionId)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp) || String(a._id).localeCompare(String(b._id)));
      },
      async listHeatmapPages() {
        const counts = new Map();
        for (const event of events) {
          if (event.event_type === "click" && event.coordinates) {
            counts.set(event.page_url, (counts.get(event.page_url) || 0) + 1);
          }
        }
        return [...counts.entries()].map(([page_url, click_count]) => ({ page_url, click_count }))
          .sort((a, b) => b.click_count - a.click_count || a.page_url.localeCompare(b.page_url));
      },
      async listHeatmapClicks(pageUrl) {
        return events.filter((event) => event.page_url === pageUrl && event.event_type === "click" && event.coordinates)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .map(({ session_id, timestamp, coordinates, viewport, scroll, page_url }) =>
            ({ session_id, timestamp, coordinates, viewport, scroll, page_url }));
      }
    }
  };
}

export async function withServer(services, run) {
  const server = http.createServer(createApp({ services }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

export function validEvent(overrides = {}) {
  return {
    session_id: "sess_test_123",
    event_type: "page_view",
    page_url: "http://localhost:5174/",
    timestamp: "2026-10-12T15:30:00.000Z",
    viewport: { width: 1440, height: 900 },
    scroll: { x: 0, y: 0 },
    ...overrides
  };
}
