export const SEARCH_VERIFICATION_PLACEHOLDER = "<!-- SEARCH_VERIFICATION_PLACEHOLDER -->";
export const SEARCH_VERIFICATION_PLACEHOLDER_RE = /^[ \t]*<!-- SEARCH_VERIFICATION_PLACEHOLDER -->[ \t]*\r?\n?/m;

const TOKEN_META_SPECS = [
  {
    env: "VITE_GOOGLE_SITE_VERIFICATION",
    name: "google-site-verification",
  },
  {
    env: "VITE_BING_SITE_VERIFICATION",
    name: "msvalidate.01",
  },
];

const RAW_META_ENV = "VITE_SEARCH_VERIFICATION_META";
const ALLOWED_META_NAMES = new Set(TOKEN_META_SPECS.map((spec) => spec.name));

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readAttribute(tag, attribute) {
  const match = tag.match(new RegExp(`${attribute}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return match ? match[2] || match[3] || "" : "";
}

function normalizeMetaTag(tag) {
  return tag.replace(/\s*\/?>\s*$/, " />");
}

function parseRawVerificationMeta(rawMeta) {
  const raw = String(rawMeta || "").trim();
  if (!raw) return [];

  const tagMatches = [...raw.matchAll(/<meta\s+[^>]*\/?>/gi)];
  const leftover = raw.replace(/<meta\s+[^>]*\/?>/gi, "").trim();
  if (leftover || tagMatches.length === 0) {
    throw new Error(
      `${RAW_META_ENV} must contain only Google/Bing site-verification <meta> tags, or use token env vars instead.`,
    );
  }

  return tagMatches.map((match) => {
    const tag = normalizeMetaTag(match[0]);
    const name = readAttribute(tag, "name");
    const content = readAttribute(tag, "content");
    if (!ALLOWED_META_NAMES.has(name) || !content.trim()) {
      throw new Error(
        `${RAW_META_ENV} may only include <meta name="google-site-verification" ...> or <meta name="msvalidate.01" ...> tags with content values.`,
      );
    }
    return tag;
  });
}

export function buildSearchVerificationMeta(env = process.env) {
  const tags = [];

  tags.push(...parseRawVerificationMeta(env[RAW_META_ENV]));

  for (const spec of TOKEN_META_SPECS) {
    const token = String(env[spec.env] || "").trim();
    if (!token) continue;
    tags.push(`<meta name="${spec.name}" content="${escapeHtml(token)}" />`);
  }

  const uniqueTags = [...new Set(tags)];
  if (uniqueTags.length === 0) return "";

  return [
    "    <!-- Search engine site verification -->",
    ...uniqueTags.map((tag) => `    ${tag}`),
  ].join("\n");
}

export function injectSearchVerificationMeta(html, env = process.env) {
  if (!SEARCH_VERIFICATION_PLACEHOLDER_RE.test(html)) return html;
  const meta = buildSearchVerificationMeta(env);
  return html.replace(SEARCH_VERIFICATION_PLACEHOLDER_RE, meta ? `${meta}\n` : "");
}
