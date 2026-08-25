#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const OFFICIAL_MESA_CALCULATOR =
  "https://tools.mesa-nhlbi.org/Calcium/input.aspx";

const RACES = [
  ["black", "0"],
  ["chinese", "1"],
  ["hispanic", "2"],
  ["white", "3"],
];
const SEXES = [
  ["female", "0"],
  ["male", "1"],
];

function decodeHtml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function textContent(value) {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[3]);
  }
  return attributes;
}

function hiddenFields(html) {
  const fields = {};
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    if (attributes.type?.toLowerCase() === "hidden" && attributes.name) {
      fields[attributes.name] = attributes.value ?? "";
    }
  }
  return fields;
}

function requestCookies(headers) {
  const setCookies = headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    return setCookies.map((value) => value.split(";", 1)[0]).join("; ");
  }
  return (headers.get("set-cookie") ?? "")
    .split(/,(?=[^;,]+=)/)
    .map((value) => value.split(";", 1)[0])
    .filter(Boolean)
    .join("; ");
}

export function buildReferenceGroups() {
  const groups = [];
  for (const [race, raceValue] of RACES) {
    for (const [sex, sexValue] of SEXES) {
      for (let age = 45; age <= 84; age += 1) {
        groups.push({
          key: `${race}:${sex}:${age}`,
          age,
          sex,
          sexValue,
          race,
          raceValue,
        });
      }
    }
  }
  return groups;
}

export function parseMesaReferenceHtml(html) {
  const probabilityBlock = html.match(
    /<span\b[^>]*id=["']Label10["'][^>]*>([\s\S]*?)<\/span>/i,
  )?.[1];
  const probabilityMatch = probabilityBlock
    ? textContent(probabilityBlock).match(/^(\d{1,3})\s*%\.?$/)
    : null;
  if (!probabilityMatch) {
    throw new Error("Official MESA response omitted probability of nonzero CAC.");
  }

  const table = html.match(
    /<table\b[^>]*id=["']Table1["'][^>]*>([\s\S]*?)<\/table>/i,
  )?.[1];
  const rows = table ? [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)] : [];
  if (rows.length !== 2) {
    throw new Error("Official MESA response omitted its four reference-score rows.");
  }
  const referenceScores = [
    ...rows[1][1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),
  ].map((match) => Number(textContent(match[1])));
  if (
    referenceScores.length !== 4 ||
    referenceScores.some((value) => !Number.isSafeInteger(value) || value < 0)
  ) {
    throw new Error("Official MESA response contained invalid reference scores.");
  }

  const probabilityNonzero = Number(probabilityMatch[1]);
  if (probabilityNonzero < 0 || probabilityNonzero > 100) {
    throw new Error("Official MESA probability was outside 0-100%.");
  }
  return { probabilityNonzero, referenceScores };
}

async function fetchGroup(group) {
  const getResponse = await fetch(OFFICIAL_MESA_CALCULATOR, {
    headers: { "user-agent": "Radulator-MESA-reference-audit/1.0" },
  });
  if (!getResponse.ok) {
    throw new Error(`MESA form GET returned HTTP ${getResponse.status}.`);
  }
  const formHtml = await getResponse.text();
  const form = new URLSearchParams({
    ...hiddenFields(formHtml),
    Age: String(group.age),
    gender: group.sexValue,
    Race: group.raceValue,
    Score: "",
    Calculate: "Calculate",
  });
  const postResponse = await fetch(OFFICIAL_MESA_CALCULATOR, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: requestCookies(getResponse.headers),
      "user-agent": "Radulator-MESA-reference-audit/1.0",
    },
    body: form,
  });
  if (!postResponse.ok) {
    throw new Error(`MESA form POST returned HTTP ${postResponse.status}.`);
  }
  const resultHtml = await postResponse.text();
  const expectedIdentity = `${group.race} ${group.sex} of age ${group.age}`;
  if (!textContent(resultHtml).includes(expectedIdentity)) {
    throw new Error(`MESA response identity mismatch for ${group.key}.`);
  }
  const parsed = parseMesaReferenceHtml(resultHtml);
  return { p: parsed.probabilityNonzero, r: parsed.referenceScores };
}

async function withRetries(group, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchGroup(group);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  const detail = lastError.cause?.message
    ? `${lastError.message}: ${lastError.cause.message}`
    : lastError.message;
  throw new Error(`${group.key}: ${detail}`);
}

export async function fetchAllReferenceData({ concurrency = 4 } = {}) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error("Concurrency must be an integer from 1 through 8.");
  }
  const groups = buildReferenceGroups();
  const records = new Array(groups.length);
  let cursor = 0;
  async function worker() {
    while (cursor < groups.length) {
      const index = cursor;
      cursor += 1;
      records[index] = await withRetries(groups[index]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return Object.fromEntries(groups.map((group, index) => [group.key, records[index]]));
}

export function validateReferenceData(data) {
  const groups = buildReferenceGroups();
  const expectedKeys = groups.map((group) => group.key);
  const actualKeys = Object.keys(data);
  assertSameKeys(actualKeys, expectedKeys);
  for (const key of expectedKeys) {
    const record = data[key];
    if (!record || Object.keys(record).join(",") !== "p,r") {
      throw new Error(`${key} must contain exactly p and r.`);
    }
    if (!Number.isSafeInteger(record.p) || record.p < 0 || record.p > 100) {
      throw new Error(`${key}.p must be an integer from 0 through 100.`);
    }
    if (
      !Array.isArray(record.r) ||
      record.r.length !== 4 ||
      record.r.some((value) => !Number.isSafeInteger(value) || value < 0) ||
      record.r.some((value, index) => index > 0 && value < record.r[index - 1])
    ) {
      throw new Error(`${key}.r must be four nondecreasing non-negative integers.`);
    }
  }
  return { groupCount: expectedKeys.length, recordFieldCount: 2 };
}

function assertSameKeys(actualKeys, expectedKeys) {
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error("MESA reference keys are incomplete, duplicated, or out of order.");
  }
}

export function hashReferenceData(data) {
  validateReferenceData(data);
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

function renderReferenceModule(data) {
  const dataSha256 = hashReferenceData(data);
  const source = {
    schema: "radulator-mesa-cac-reference/v2",
    officialCalculator: OFFICIAL_MESA_CALCULATOR,
    method:
      "TLS-verified POSTs of non-PHI age, sex, and race inputs; stores only official probability of nonzero CAC and 25th/50th/75th/90th reference scores.",
    tlsVerified: true,
    referencePage:
      "https://mesa-nhlbi.org/researchers/tools/cac-score-reference-values",
    publicationDoi: "10.1161/CIRCULATIONAHA.105.580696",
    publicationPmid: "16365194",
    ageRange: [45, 84],
    races: RACES.map(([race]) => race),
    sexes: SEXES.map(([sex]) => sex),
    groupCount: buildReferenceGroups().length,
    recordFields: ["p", "r"],
    dataSha256,
  };
  return `// Generated by scripts/generate-mesa-cac-reference.mjs using verified TLS.\n// Do not edit this file by hand.\nexport const MESA_CAC_REFERENCE_SOURCE = ${JSON.stringify(source, null, 2)};\n\n// Keys are \`race:sex:age\`. p=probability of nonzero CAC (%);\n// r=[25th, 50th, 75th, 90th] official reference Agatston scores.\nexport const MESA_CAC_REFERENCE = ${JSON.stringify(data, null, 2)};\n`;
}

function auditEntry([key, record]) {
  return {
    key,
    p: record.p,
    r: record.r,
    recordSha256: createHash("sha256")
      .update(JSON.stringify(record))
      .digest("hex"),
  };
}

export async function writeAuditFiles(
  outputDir,
  data,
  { auditedAt = new Date().toISOString() } = {},
) {
  validateReferenceData(data);
  await mkdir(outputDir, { recursive: true });
  const chunks = [];
  for (const [race] of RACES) {
    for (const [sex] of SEXES) {
      const filename = `${race}-${sex}.json`;
      const entries = Object.entries(data).filter(([key]) =>
        key.startsWith(`${race}:${sex}:`),
      );
      const chunkData = Object.fromEntries(entries);
      const chunk = {
        schema: "radulator-mesa-cac-reference-audit-chunk/v1",
        auditedAt,
        officialCalculator: OFFICIAL_MESA_CALCULATOR,
        tlsVerified: true,
        race,
        sex,
        groupCount: entries.length,
        dataSha256: hashReferenceData(data),
        chunkSha256: createHash("sha256")
          .update(JSON.stringify(chunkData))
          .digest("hex"),
        groups: entries.map(auditEntry),
      };
      await writeFile(
        join(outputDir, filename),
        `${JSON.stringify(chunk, null, 2)}\n`,
        { mode: 0o644 },
      );
      chunks.push({
        file: filename,
        race,
        sex,
        groupCount: entries.length,
        chunkSha256: chunk.chunkSha256,
      });
    }
  }
  const manifest = {
    schema: "radulator-mesa-cac-reference-audit-manifest/v1",
    auditedAt,
    officialCalculator: OFFICIAL_MESA_CALCULATOR,
    tlsVerified: true,
    groupCount: buildReferenceGroups().length,
    dataSha256: hashReferenceData(data),
    chunks,
  };
  await writeFile(
    join(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o644 },
  );
  return manifest;
}

function parseCli(argv) {
  const options = { concurrency: 4 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--output") options.output = argv[(index += 1)];
    else if (argument === "--audit-output-dir")
      options.auditOutputDir = argv[(index += 1)];
    else if (argument === "--concurrency")
      options.concurrency = Number(argv[(index += 1)]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.output || !options.auditOutputDir) {
    throw new Error(
      "Usage: --output FILE --audit-output-dir DIR [--concurrency 1-8]",
    );
  }
  return options;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  const data = await fetchAllReferenceData({ concurrency: options.concurrency });
  validateReferenceData(data);
  await writeFile(options.output, renderReferenceModule(data), { mode: 0o644 });
  await writeAuditFiles(options.auditOutputDir, data);
  console.log(
    JSON.stringify({
      ok: true,
      groupCount: Object.keys(data).length,
      dataSha256: hashReferenceData(data),
      output: options.output,
      auditOutputDir: options.auditOutputDir,
    }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
