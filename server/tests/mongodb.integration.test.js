import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { app } from "../src/app.js";
import { Event } from "../src/models/Event.js";
import { env } from "../src/config/env.js";

const testUri = process.env.MONGODB_TEST_URI;
const testDbName = testUri ? new URL(testUri).pathname.replace(/^\//, "") : "";
const developmentDbName = (() => {
  try { return new URL(env.mongoUri).pathname.replace(/^\//, ""); }
  catch { return ""; }
})();

function assertSafeTestDatabase() {
  if (!testUri) throw new Error("MONGODB_TEST_URI is required for MongoDB integration tests");
  if (testDbName !== "tracelens_test") {
    throw new Error('Safety check: MONGODB_TEST_URI must target the database named "tracelens_test"');
  }
  if (testUri === env.mongoUri || testDbName === developmentDbName) {
    throw new Error("Safety check: test database must be different from MONGODB_URI");
  }
}

test("MongoDB integration: event ingestion, sessions, chronology and heatmap", {
  skip: !testUri && "Set MONGODB_TEST_URI=mongodb://127.0.0.1:27017/tracelens_test to run against an isolated test database"
}, async () => {
  assertSafeTestDatabase();
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5000 });
  try {
    // Clear only the events collection in the explicitly allow-listed test database.
    await Event.deleteMany({});
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const send = async (event) => fetch(`${baseUrl}/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session_id: "sess_mongo_integration",
        event_type: "page_view",
        page_url: "http://localhost:5174/",
        timestamp: "2026-10-12T12:00:00.000Z",
        ...event
      })
    });

    try {
      const newest = await send({ event_type: "click", timestamp: "2026-10-12T12:00:02.000Z", coordinates: { x: 100, y: 150 } });
      assert.equal(newest.status, 201);
      const oldest = await send({ event_type: "page_view", timestamp: "2026-10-12T12:00:00.000Z" });
      assert.equal(oldest.status, 201);
      const middle = await send({ event_type: "click", timestamp: "2026-10-12T12:00:01.000Z", coordinates: { x: 200, y: 250 } });
      assert.equal(middle.status, 201);

      const storedCount = await Event.countDocuments({ session_id: "sess_mongo_integration" });
      assert.equal(storedCount, 3, "events should persist to MongoDB");

      const journeyResponse = await fetch(`${baseUrl}/api/sessions/sess_mongo_integration/events`);
      assert.equal(journeyResponse.status, 200);
      const journey = (await journeyResponse.json()).data.events;
      assert.deepEqual(journey.map((event) => new Date(event.timestamp).toISOString()), [
        "2026-10-12T12:00:00.000Z",
        "2026-10-12T12:00:01.000Z",
        "2026-10-12T12:00:02.000Z"
      ]);

      const sessionsResponse = await fetch(`${baseUrl}/api/sessions?page=1&limit=10`);
      assert.equal(sessionsResponse.status, 200);
      const sessions = (await sessionsResponse.json()).data;
      assert.ok(sessions.items.some((item) => item.session_id === "sess_mongo_integration" && item.event_count === 3));

      const pagesResponse = await fetch(`${baseUrl}/api/heatmap/pages`);
      assert.equal(pagesResponse.status, 200);
      const pages = (await pagesResponse.json()).data;
      assert.ok(pages.some((page) => page.page_url === "http://localhost:5174/" && page.click_count === 2));

      const clicksResponse = await fetch(`${baseUrl}/api/heatmap/clicks?pageUrl=${encodeURIComponent("http://localhost:5174/")}`);
      assert.equal(clicksResponse.status, 200);
      const clicks = (await clicksResponse.json()).data.clicks;
      assert.equal(clicks.length, 2);
      assert.ok(clicks.every((click) => Number.isFinite(click.coordinates.x) && Number.isFinite(click.coordinates.y)));
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    await Event.deleteMany({});
    await mongoose.disconnect();
  }
});
