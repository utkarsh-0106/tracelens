import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryServices, withServer, validEvent } from "./helpers.js";

test("POST /api/events persists a valid page-view event", async () => {
  const { services, events } = createMemoryServices();
  await withServer(services, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/events`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(validEvent())
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.data.session_id, "sess_test_123");
    assert.equal(body.data.event_type, "page_view");
    assert.equal(events.length, 1);
    assert.equal(events[0].page_url, "http://localhost:5174/");
  });
});

test("POST /api/events accepts clicks with coordinates", async () => {
  const { services, events } = createMemoryServices();
  await withServer(services, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/events`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(validEvent({ event_type: "click", coordinates: { x: 120, y: 240 } }))
    });
    assert.equal(response.status, 201);
    assert.deepEqual(events[0].coordinates, { x: 120, y: 240 });
  });
});

test("POST /api/events rejects invalid payloads without persisting", async () => {
  const { services, events } = createMemoryServices();
  const cases = [
    validEvent({ session_id: "" }),
    validEvent({ event_type: "unknown" }),
    validEvent({ page_url: "not a URL" }),
    validEvent({ timestamp: "not a date" }),
    validEvent({ event_type: "click" }),
    validEvent({ event_type: "click", coordinates: { x: -1, y: 4 } })
  ];
  await withServer(services, async (baseUrl) => {
    for (const payload of cases) {
      const response = await fetch(`${baseUrl}/api/events`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
    }
    assert.equal(events.length, 0);
  });
});

test("POST /api/events rejects malformed JSON with a clear 400 response", async () => {
  const { services } = createMemoryServices();
  await withServer(services, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{broken"
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_JSON");
  });
});

test("GET /api/sessions returns counts, timestamps and pagination", async () => {
  const { services } = createMemoryServices();
  await withServer(services, async (baseUrl) => {
    for (const event of [
      validEvent({ timestamp: "2026-10-12T10:00:00.000Z" }),
      validEvent({ timestamp: "2026-10-12T11:00:00.000Z" }),
      validEvent({ session_id: "sess_second", timestamp: "2026-10-12T12:00:00.000Z" })
    ]) {
      await fetch(`${baseUrl}/api/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(event) });
    }
    const response = await fetch(`${baseUrl}/api/sessions?page=1&limit=1`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.items.length, 1);
    assert.equal(body.data.items[0].session_id, "sess_second");
    assert.deepEqual(body.data.pagination, { page: 1, limit: 1, total: 2, pages: 2 });
    const invalid = await fetch(`${baseUrl}/api/sessions?page=0&limit=1000`);
    assert.equal(invalid.status, 400);
  });
});

test("GET /api/sessions/:id/events returns events chronologically", async () => {
  const { services } = createMemoryServices();
  await withServer(services, async (baseUrl) => {
    for (const timestamp of ["2026-10-12T12:00:00Z", "2026-10-12T09:00:00Z", "2026-10-12T10:00:00Z"]) {
      await fetch(`${baseUrl}/api/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validEvent({ timestamp })) });
    }
    const response = await fetch(`${baseUrl}/api/sessions/sess_test_123/events`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.events.map((event) => new Date(event.timestamp).toISOString()), [
      "2026-10-12T09:00:00.000Z", "2026-10-12T10:00:00.000Z", "2026-10-12T12:00:00.000Z"
    ]);
  });
});

test("heatmap endpoints aggregate click pages and return coordinates for selected page", async () => {
  const { services } = createMemoryServices();
  await withServer(services, async (baseUrl) => {
    const inputs = [
      validEvent({ event_type: "click", coordinates: { x: 20, y: 30 }, page_url: "http://localhost:5174/" }),
      validEvent({ event_type: "click", coordinates: { x: 40, y: 50 }, page_url: "http://localhost:5174/" }),
      validEvent({ event_type: "click", coordinates: { x: 10, y: 15 }, page_url: "http://localhost:5174/#story" }),
      validEvent({ event_type: "page_view", page_url: "http://localhost:5174/#story" })
    ];
    for (const payload of inputs) {
      await fetch(`${baseUrl}/api/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    }
    const pagesResponse = await fetch(`${baseUrl}/api/heatmap/pages`);
    const pages = (await pagesResponse.json()).data;
    assert.deepEqual(pages, [
      { page_url: "http://localhost:5174/", click_count: 2 },
      { page_url: "http://localhost:5174/#story", click_count: 1 }
    ]);
    const clicksResponse = await fetch(`${baseUrl}/api/heatmap/clicks?pageUrl=${encodeURIComponent("http://localhost:5174/")}`);
    const clicks = (await clicksResponse.json()).data.clicks;
    assert.equal(clicks.length, 2);
    assert.ok(clicks.every((click) => click.coordinates && click.page_url === "http://localhost:5174/"));
    const invalid = await fetch(`${baseUrl}/api/heatmap/clicks`);
    assert.equal(invalid.status, 400);
  });
});

test("unknown routes return 404 and service failures return a sanitized 500", async () => {
  const memory = createMemoryServices();
  const services = {
    ...memory.services,
    async listHeatmapPages() { throw new Error("database credentials must not leak"); }
  };
  await withServer(services, async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/api/no-such-route`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, "NOT_FOUND");
    const failed = await fetch(`${baseUrl}/api/heatmap/pages`);
    assert.equal(failed.status, 500);
    const body = await failed.json();
    assert.equal(body.error.code, "INTERNAL_ERROR");
    assert.ok(!JSON.stringify(body).includes("credentials"));
  });
});
