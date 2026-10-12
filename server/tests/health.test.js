import test from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";
import http from "node:http";

test("health endpoint responds with API status", async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.status, "ok");
    assert.ok(["connected", "disconnected"].includes(body.data.database));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
