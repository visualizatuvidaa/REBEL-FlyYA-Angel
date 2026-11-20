import assert from "node:assert/strict";
import test from "node:test";
import worker from "./worker.js";

const env = { OPENAI_API_KEY: "test-only" };
const request = (path, init) => new Request("https://rebel.example" + path, init);
const coach = (body, bindings = env) =>
  worker.fetch(request("/api/coach", { method: "POST", body }), bindings);

test("rejects invalid requests without contacting OpenAI", async (context) => {
  const upstream = context.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected upstream call");
  });
  const invalidBodies = ["{", "null", "[]", "{}", JSON.stringify({ message: 42 }),
    JSON.stringify({ message: " " }), JSON.stringify({ message: "a".repeat(1201) })];
  for (const body of invalidBodies) {
    assert.equal((await coach(body)).status, 400);
  }
  assert.equal((await worker.fetch(request("/api/coach"), env)).status, 405);
  assert.equal((await coach(JSON.stringify({ message: "valid" }), {})).status, 503);
  assert.equal(upstream.mock.callCount(), 0);
});

test("forwards valid text and filters malformed history", async (context) => {
  context.mock.method(globalThis, "fetch", async (_url, init) => {
    const { messages } = JSON.parse(init.body);
    assert.deepEqual(messages.slice(1), [
      { role: "assistant", content: "Earlier lesson" },
      { role: "user", content: "Practice drums" }
    ]);
    return Response.json({ choices: [{ message: { content: "Try a steady beat." } }] });
  });
  const response = await coach(JSON.stringify({
    message: " Practice drums ",
    history: [null, { role: "system", content: "ignored" }, { role: "assistant", content: "Earlier lesson" }]
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { reply: "Try a steady beat." });
});

test("maps upstream failures to 502", async (context) => {
  const upstream = context.mock.method(globalThis, "fetch", async () => new Response("", { status: 429 }));
  const body = JSON.stringify({ message: "practice" });
  assert.equal((await coach(body)).status, 502);
  upstream.mock.mockImplementation(async () => new Response("not JSON"));
  assert.equal((await coach(body)).status, 502);
  upstream.mock.mockImplementation(async () => { throw new Error("Network unavailable"); });
  assert.equal((await coach(body)).status, 502);
});

test("keeps API 404 separate from static files", async () => {
  const assets = { fetch: async () => new Response("asset") };
  assert.equal((await worker.fetch(request("/api/unknown"), { ASSETS: assets })).status, 404);
  assert.equal(await (await worker.fetch(request("/"), { ASSETS: assets })).text(), "asset");
});
