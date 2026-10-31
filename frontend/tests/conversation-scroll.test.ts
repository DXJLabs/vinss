import assert from "node:assert/strict";
import test from "node:test";
import { distanceToLatest, scrollToLatest } from "../lib/ui/conversationScroll";

test("mobile document flow measures the message end against the viewport", () => {
  assert.equal(distanceToLatest({ internal: false, endBottom: 1400, viewportHeight: 800, scrollHeight: 100, scrollTop: 0, clientHeight: 100 }), 600);
  assert.equal(distanceToLatest({ internal: false, endBottom: 750, viewportHeight: 800, scrollHeight: 100, scrollTop: 0, clientHeight: 100 }), 0);
});
test("desktop timeline follows only its own scroll area", () => {
  assert.equal(distanceToLatest({ internal: true, endBottom: 9000, viewportHeight: 800, scrollHeight: 2000, scrollTop: 1000, clientHeight: 600 }), 400);
  let areaTop = 0;
  let pageMoved = false;
  scrollToLatest({ scrollHeight: 2000, scrollTo: (options) => { areaTop = typeof options === "number" ? options : options?.top ?? 0; } }, { scrollIntoView: () => { pageMoved = true; } }, true, "auto");
  assert.equal(areaTop, 2000);
  assert.equal(pageMoved, false);
});
