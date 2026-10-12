import test from "node:test";
import assert from "node:assert/strict";
import { createEventService } from "../src/services/eventService.js";

test("listSessionEvents asks the model for deterministic chronological ordering", async () => {
  const expected = [{ _id: "a", timestamp: new Date("2026-01-01T00:00:00Z") }];
  let querySeen;
  let sortSeen;
  const model = {
    find(query) {
      querySeen = query;
      return {
        sort(sort) {
          sortSeen = sort;
          return { lean: async () => expected };
        }
      };
    }
  };
  const service = createEventService(model);
  assert.deepEqual(await service.listSessionEvents("sess_a"), expected);
  assert.deepEqual(querySeen, { session_id: "sess_a" });
  assert.deepEqual(sortSeen, { timestamp: 1, _id: 1 });
});

test("listHeatmapClicks filters to a page's click events with coordinates", async () => {
  let querySeen;
  let projectionSeen;
  let sortSeen;
  const expected = [{ page_url: "http://localhost:5174/", coordinates: { x: 1, y: 2 } }];
  const model = {
    find(query) {
      querySeen = query;
      return {
        select(projection) {
          projectionSeen = projection;
          return {
            sort(sort) {
              sortSeen = sort;
              return { lean: async () => expected };
            }
          };
        }
      };
    }
  };
  const service = createEventService(model);
  assert.deepEqual(await service.listHeatmapClicks("http://localhost:5174/"), expected);
  assert.deepEqual(querySeen, {
    page_url: "http://localhost:5174/", event_type: "click",
    "coordinates.x": { $exists: true }, "coordinates.y": { $exists: true }
  });
  assert.deepEqual(sortSeen, { timestamp: -1 });
  assert.ok(projectionSeen.coordinates);
});

test("listSessions builds grouped pagination and counts distinct sessions", async () => {
  let pipelineSeen;
  const model = {
    aggregate: async (pipeline) => { pipelineSeen = pipeline; return [{ session_id: "sess_a", event_count: 2 }]; },
    distinct: async (field) => { assert.equal(field, "session_id"); return ["sess_a", "sess_b"]; }
  };
  const service = createEventService(model);
  const result = await service.listSessions({ page: 2, limit: 1 });
  assert.equal(result.items[0].event_count, 2);
  assert.deepEqual(result.pagination, { page: 2, limit: 1, total: 2, pages: 2 });
  assert.deepEqual(pipelineSeen.find((stage) => "$skip" in stage), { $skip: 1 });
  assert.deepEqual(pipelineSeen.find((stage) => "$limit" in stage), { $limit: 1 });
});
