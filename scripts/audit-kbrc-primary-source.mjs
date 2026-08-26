#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { inflateRawSync } from "node:zlib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  calculateBmi,
  calculateKbrcMajorBleedingProbability,
} from "../src/components/calculators/KidneyBiopsyBleedingRisk.jsx";

const REGISTRY_PATH =
  "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json";
const FIXTURE_PATH = "tests/fixtures/compute/kidney-biopsy-bleeding-risk.json";
const CALCULATOR_PATH = "src/components/calculators/KidneyBiopsyBleedingRisk.jsx";
const SOURCE_VARIABLES = new Map([
  ["Age", "age"],
  ["Size", "kidneySize"],
  ["PreHg", "hemoglobin"],
  ["Plts", "platelets"],
  ["Native", "native"],
  ["BMI", "bmi"],
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fetchBuffer(url) {
  let lastFailure = "unknown retrieval failure";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Radulator-KBRC-primary-source-audit/1" },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      lastFailure = `HTTP ${response.status}`;
      await response.body?.cancel();
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  assert.fail(`${url}: primary-source retrieval failed after 3 attempts (${lastFailure})`);
}

function findZipMember(archive, memberName) {
  const minimumEocdOffset = Math.max(0, archive.length - 65557);
  let eocdOffset = -1;
  for (let offset = archive.length - 22; offset >= minimumEocdOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  assert.notEqual(eocdOffset, -1, "supplement archive lacks a ZIP end record");

  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  let offset = archive.readUInt32LE(eocdOffset + 16);
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(
      archive.readUInt32LE(offset),
      0x02014b50,
      `invalid ZIP central-directory entry ${index}`,
    );
    const compression = archive.readUInt16LE(offset + 10);
    const compressedBytes = archive.readUInt32LE(offset + 20);
    const uncompressedBytes = archive.readUInt32LE(offset + 24);
    const nameBytes = archive.readUInt16LE(offset + 28);
    const extraBytes = archive.readUInt16LE(offset + 30);
    const commentBytes = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.subarray(offset + 46, offset + 46 + nameBytes).toString("utf8");

    if (name === memberName) {
      assert.equal(archive.readUInt32LE(localOffset), 0x04034b50, `${name}: invalid local header`);
      const localNameBytes = archive.readUInt16LE(localOffset + 26);
      const localExtraBytes = archive.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameBytes + localExtraBytes;
      const compressed = archive.subarray(dataOffset, dataOffset + compressedBytes);
      const member =
        compression === 0
          ? Buffer.from(compressed)
          : compression === 8
            ? inflateRawSync(compressed)
            : null;
      assert.ok(member, `${name}: unsupported ZIP compression method ${compression}`);
      assert.equal(member.length, uncompressedBytes, `${name}: uncompressed length`);
      return member;
    }

    offset += 46 + nameBytes + extraBytes + commentBytes;
  }
  assert.fail(`supplement archive is missing ${memberName}`);
}

async function pdfText(pdfBytes) {
  const document = await getDocument({
    data: new Uint8Array(pdfBytes),
    disableWorker: true,
    useSystemFonts: true,
  }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map(({ str }) => str).join(" "));
  }
  await document.destroy();
  return pages.join("\n");
}

function parseSourceEquation(text) {
  const compact = text.replace(/\s+/g, "");
  const locator = "ItemS1:Equationforrefitmodeloncombineddataset";
  const locatorOffset = compact.indexOf(locator);
  assert.notEqual(locatorOffset, -1, "supplement PDF lacks Item S1");
  const prefix = "Probabilityofmajorcomplication=1/(1+exp(-(";
  const expressionOffset = compact.indexOf(prefix, locatorOffset);
  assert.notEqual(expressionOffset, -1, "Item S1 lacks the logistic equation");
  const start = expressionOffset + prefix.length;
  const end = compact.indexOf(")))", start);
  assert.notEqual(end, -1, "Item S1 logistic equation is unterminated");
  const expression = compact.slice(start, end);

  const numberPattern = String.raw`\d+(?:\.\d+)?(?:e[+-]?\d+)?`;
  const intercept = expression.match(new RegExp(`^(${numberPattern})`));
  assert.ok(intercept, "Item S1 intercept could not be parsed");
  const terms = [{ sign: "+", coefficient: Number(intercept[1]), input: "constant" }];
  const termPattern = new RegExp(
    `([+-])(${numberPattern})\\*(?:pmax\\(([A-Za-z]+)-(${numberPattern}),0\\)\\^3|([A-Za-z]+))`,
    "gy",
  );
  termPattern.lastIndex = intercept[0].length;
  while (termPattern.lastIndex < expression.length) {
    const match = termPattern.exec(expression);
    assert.ok(match, `unparsed Item S1 equation at character ${termPattern.lastIndex}`);
    const sourceInput = match[3] ?? match[5];
    const input = SOURCE_VARIABLES.get(sourceInput);
    assert.ok(input, `unsupported Item S1 input ${sourceInput}`);
    const term = { sign: match[1], coefficient: Number(match[2]), input };
    if (match[3]) term.positive_part_cubic_knot = Number(match[4]);
    terms.push(term);
  }
  return terms;
}

function parseRuntimeEquation(source) {
  const functionStart = source.indexOf("export function calculateKbrcMajorBleedingProbability");
  assert.notEqual(functionStart, -1, "runtime KBRC probability function is missing");
  const expressionMatch = source
    .slice(functionStart)
    .match(/const\s+linearPredictor\s*=([\s\S]*?);/);
  assert.ok(expressionMatch, "runtime KBRC linear predictor is missing");
  const expression = expressionMatch[1].replace(/\s+/g, "");
  const numberPattern = String.raw`\d+(?:\.\d+)?(?:e[+-]?\d+)?`;
  const intercept = expression.match(new RegExp(`^(${numberPattern})`));
  assert.ok(intercept, "runtime KBRC intercept could not be parsed");
  const terms = [{ sign: "+", coefficient: Number(intercept[1]), input: "constant" }];
  const termPattern = new RegExp(
    `([+-])(${numberPattern})\\*(?:pp\\(([A-Za-z_][A-Za-z0-9_]*),(${numberPattern})\\)|Number\\(([A-Za-z_][A-Za-z0-9_]*)\\)|([A-Za-z_][A-Za-z0-9_]*))`,
    "gy",
  );
  termPattern.lastIndex = intercept[0].length;
  while (termPattern.lastIndex < expression.length) {
    const match = termPattern.exec(expression);
    assert.ok(match, `unparsed runtime equation at character ${termPattern.lastIndex}`);
    const term = {
      sign: match[1],
      coefficient: Number(match[2]),
      input: match[3] ?? match[5] ?? match[6],
    };
    if (match[3]) term.positive_part_cubic_knot = Number(match[4]);
    terms.push(term);
  }
  return terms;
}

function decodeXmlText(fragment) {
  return fragment
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#x02265;", "≥")
    .replace(/\s+/g, " ")
    .trim();
}

function combinedCohortMedians(xml) {
  const table = xml.match(/<table-wrap id="tbl1"[\s\S]*?<\/table-wrap>/)?.[0];
  assert.ok(table, "full-text XML lacks Table 1");
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((match) =>
    [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) =>
      decodeXmlText(cell[1]),
    ),
  );
  const readLastNumber = (label, pattern) => {
    const row = rows.find(([name]) => pattern.test(name));
    assert.ok(row, `Table 1 lacks ${label}`);
    const value = Number.parseFloat(row.at(-1));
    assert.ok(Number.isFinite(value), `Table 1 ${label} combined value is invalid`);
    return value;
  };
  return {
    age: readLastNumber("Age", /^Age \(y\)$/),
    platelets: readLastNumber("Platelets", /^Platelets \(/),
    hemoglobin: readLastNumber("Pre-hemoglobin", /^Pre-hemoglobin \(g\/L\)$/),
    kidneySize: readLastNumber("Kidney size", /^Kidney size \(cm\)$/),
    bmi: readLastNumber("Body mass index", /^Body mass index \(/),
  };
}

function parsePublishedExamples(xml) {
  const medians = combinedCohortMedians(xml);
  const paragraph = xml.match(/<p id="p0115">([\s\S]*?)<\/p>/)?.[1];
  assert.ok(paragraph, "full-text XML lacks the published-example paragraph p0115");
  const text = decodeXmlText(paragraph).replaceAll("×", "x");
  const typical = text.match(
    /native kidney biopsy would have an assigned risk of major bleeding of ([\d.]+)%.*?allograft kidney biopsy, would have a ([\d.]+)% risk/s,
  );
  assert.ok(typical, "published typical native/allograft examples could not be parsed");
  const higher = text.match(
    /a ([\d.]+)-year-old patient requiring native kidney biopsy.*?\(([\d.]+) cm kidney length, preprocedural hemoglobin ([\d.]+) g\/L, platelets ([\d.]+).*?and BMI ([\d.]+) kg\/m.*?\).*?risk of ([\d.]+)%/s,
  );
  assert.ok(higher, "published higher-risk native example could not be parsed");
  const lower = text.match(
    /a ([\d.]+)-year-old patient presenting for allograft kidney biopsy with ([\d.]+) cm kidney length, preprocedural hemoglobin ([\d.]+) g\/L, platelets ([\d.]+).*?and BMI ([\d.]+) kg\/m.*?has a major bleeding risk of ([\d.]+)%/s,
  );
  assert.ok(lower, "published lower-risk allograft example could not be parsed");

  const display = (value) => `${Number(value).toFixed(1)}%`;
  return [
    { id: "paper-typical-native", ...medians, native: true, display: display(typical[1]) },
    { id: "paper-typical-allograft", ...medians, native: false, display: display(typical[2]) },
    {
      id: "paper-higher-risk-native",
      age: Number(higher[1]),
      kidneySize: Number(higher[2]),
      hemoglobin: Number(higher[3]),
      platelets: Number(higher[4]),
      bmi: Number(higher[5]),
      native: true,
      display: display(higher[6]),
    },
    {
      id: "paper-lower-risk-allograft",
      age: Number(lower[1]),
      kidneySize: Number(lower[2]),
      hemoglobin: Number(lower[3]),
      platelets: Number(lower[4]),
      bmi: Number(lower[5]),
      native: false,
      display: display(lower[6]),
    },
  ];
}

function assertRuntimeAndFixtures(vectors, fixture) {
  const cases = new Map(fixture.cases.map((testCase) => [testCase.id, testCase]));
  for (const vector of vectors) {
    const runtime = calculateKbrcMajorBleedingProbability(vector);
    assert.equal(
      `${(runtime.probability * 100).toFixed(1)}%`,
      vector.display,
      `${vector.id}: runtime display drifted from the primary publication`,
    );
    const testCase = cases.get(vector.id);
    assert.ok(testCase, `${vector.id}: canonical compute fixture is missing`);
    assert.equal(Number(testCase.inputs.age), vector.age, `${vector.id}: age`);
    assert.equal(Number(testCase.inputs.platelets), vector.platelets, `${vector.id}: platelets`);
    assert.equal(Number(testCase.inputs.hemoglobin), vector.hemoglobin, `${vector.id}: hemoglobin`);
    assert.equal(Number(testCase.inputs.kidney_size), vector.kidneySize, `${vector.id}: kidney size`);
    assert.equal(testCase.inputs.kidney_type, vector.native ? "native" : "allograft");
    assert.ok(
      Math.abs(calculateBmi(testCase.inputs.weight, testCase.inputs.height) - vector.bmi) <= 1e-12,
      `${vector.id}: fixture BMI drifted from the primary publication`,
    );
    const output = testCase.expect.fields.find(
      ({ key }) => key === "Estimated major bleeding risk after kidney biopsy",
    );
    assert.equal(output?.equals, vector.display, `${vector.id}: fixture output`);
  }
}

async function main() {
  const [registryBytes, fixtureBytes, calculatorBytes] = await Promise.all([
    readFile(REGISTRY_PATH),
    readFile(FIXTURE_PATH),
    readFile(CALCULATOR_PATH),
  ]);
  const registry = JSON.parse(registryBytes);
  const fixture = JSON.parse(fixtureBytes);
  const record = registry.records.find(
    ({ calculator_id }) => calculator_id === "kidney-biopsy-bleeding-risk",
  );
  const artifact = record?.implementation_evidence?.source_artifact;
  assert.ok(artifact, "KBRC registry lacks source_artifact metadata");

  const [xmlBytes, archive] = await Promise.all([
    fetchBuffer(artifact.full_text_xml_url),
    fetchBuffer(artifact.archive_url),
  ]);
  const xml = xmlBytes.toString("utf8");
  assert.match(xml, /<article-id pub-id-type="pmcid">PMC13156734<\/article-id>/);
  assert.match(xml, /CC BY-NC-ND license/);
  assert.match(xml, /xlink:href="mmc1\.pdf"/);

  const member = findZipMember(archive, artifact.archive_member);
  assert.equal(member.length, artifact.archive_member_bytes, "supplement member size");
  assert.equal(sha256(member), artifact.archive_member_sha256, "supplement member digest");
  const sourceTerms = parseSourceEquation(await pdfText(member));
  const runtimeTerms = parseRuntimeEquation(calculatorBytes.toString("utf8"));
  assert.equal(sourceTerms.length, 22, "Item S1 equation term count");
  assert.deepEqual(runtimeTerms, sourceTerms, "runtime equation drifted from Item S1");

  const vectors = parsePublishedExamples(xml);
  assertRuntimeAndFixtures(vectors, fixture);
  const audit = {
    schema: "radulator-kbrc-primary-source-audit/v1",
    article_pmcid: "PMC13156734",
    archive_member: artifact.archive_member,
    archive_member_bytes: member.length,
    archive_member_sha256: sha256(member),
    license: "CC BY-NC-ND 4.0",
    equation_term_count: sourceTerms.length,
    source_example_displays: vectors.map(({ display }) => display),
    runtime_equation_match: true,
    runtime_vector_match: true,
    fixture_vector_match: true,
    source_bytes_committed: false,
  };
  process.stdout.write(`${JSON.stringify(audit, null, process.argv.includes("--json") ? 0 : 2)}\n`);
}

await main();
