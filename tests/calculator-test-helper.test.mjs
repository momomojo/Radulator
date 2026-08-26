import assert from "node:assert/strict";
import { verifyReferenceLinks } from "./helpers/calculator-test-helper.js";

let active = 0;
let maximumActive = 0;
const links = Array.from({ length: 12 }, (_, index) => ({
  async getAttribute(name) {
    assert.equal(name, "href");
    return `https://example.test/reference-${index}`;
  },
}));
const page = {
  locator(selector) {
    assert.equal(selector, 'a[href^="http"]');
    return { async all() { return links; } };
  },
  request: {
    async get(_href, options) {
      assert.deepEqual(options, { timeout: 5000 });
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { status() { return 200; } };
    },
  },
};

const broken = await verifyReferenceLinks(page);

assert.deepEqual(broken, []);
assert.ok(maximumActive > 1, "the helper should retain bounded parallelism");
assert.ok(
  maximumActive <= 4,
  `reference verification exceeded the four-request cap: ${maximumActive}`,
);
console.log("calculator reference-link concurrency regression passed");
