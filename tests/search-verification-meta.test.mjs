#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  buildSearchVerificationMeta,
  injectSearchVerificationMeta,
} from "../scripts/search-verification-meta.mjs";

const tokenMeta = buildSearchVerificationMeta({
  VITE_GOOGLE_SITE_VERIFICATION: "google-token",
  VITE_BING_SITE_VERIFICATION: "bing-token",
});
assert.match(tokenMeta, /google-site-verification/);
assert.match(tokenMeta, /content="google-token"/);
assert.match(tokenMeta, /msvalidate\.01/);
assert.match(tokenMeta, /content="bing-token"/);

const escapedMeta = buildSearchVerificationMeta({
  VITE_GOOGLE_SITE_VERIFICATION: "abc\"<>&",
});
assert.match(escapedMeta, /abc&quot;&lt;&gt;&amp;/);

const rawMeta = buildSearchVerificationMeta({
  VITE_SEARCH_VERIFICATION_META:
    '<meta name="google-site-verification" content="raw-google"><meta name="msvalidate.01" content="raw-bing">',
});
assert.match(rawMeta, /content="raw-google"/);
assert.match(rawMeta, /content="raw-bing"/);

assert.throws(
  () => buildSearchVerificationMeta({ VITE_SEARCH_VERIFICATION_META: '<script>alert("nope")</script>' }),
  /must contain only Google\/Bing site-verification <meta> tags/,
);

const html = `<html><head>\n    <!-- SEARCH_VERIFICATION_PLACEHOLDER -->\n<title>Radulator</title></head></html>`;
const injected = injectSearchVerificationMeta(html, { VITE_GOOGLE_SITE_VERIFICATION: "google-token" });
assert.doesNotMatch(injected, /SEARCH_VERIFICATION_PLACEHOLDER/);
assert.match(injected, /google-site-verification/);

const empty = injectSearchVerificationMeta(html, {});
assert.doesNotMatch(empty, /SEARCH_VERIFICATION_PLACEHOLDER/);
assert.doesNotMatch(empty, /site-verification/);

console.log("search-verification-meta tests passed");
