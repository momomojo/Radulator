#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { inflateRawSync } from "node:zlib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  KBRC_CALIBRATION_WARNING_THRESHOLD,
  KBRC_INPUT_LIMITS,
  KBRC_INPUT_LIMIT_PROVENANCE,
  calculateBmi,
  calculateKbrcMajorBleedingProbability,
  computeKidneyBiopsyBleedingRisk,
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

async function fetchSupplement(artifact) {
  try {
    const direct = await fetchBuffer(artifact.direct_pdf_url);
    assert.equal(direct.length, artifact.archive_member_bytes, "direct supplement size");
    assert.equal(sha256(direct), artifact.archive_member_sha256, "direct supplement digest");
    return { bytes: direct, retrieval: "direct-publisher-pdf" };
  } catch (directError) {
    const archive = await fetchBuffer(artifact.archive_url);
    const member = findZipMember(archive, artifact.archive_member);
    assert.equal(member.length, artifact.archive_member_bytes, "fallback supplement size");
    assert.equal(sha256(member), artifact.archive_member_sha256, "fallback supplement digest");
    return {
      bytes: member,
      retrieval: "europe-pmc-archive-fallback",
      direct_error: directError instanceof Error ? directError.message : String(directError),
    };
  }
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

function parseCalibrationWarning(xml) {
  const paragraph = xml.match(/<p id="p0130">([\s\S]*?)<\/p>/)?.[1];
  assert.ok(paragraph, "full-text XML lacks discussion paragraph p0130");
  const text = decodeXmlText(paragraph);
  const calibration = text.match(
    /probability range exceeding ([\d.]+)% risk where the model begins to (overpredict) risk/i,
  );
  assert.ok(calibration, "p0130 lacks the calibration warning and threshold");
  return {
    source_locator: "full-text XML paragraph p0130",
    threshold_probability: Number(calibration[1]) / 100,
    calibration_direction: calibration[2].toLowerCase(),
  };
}

function assertRuntimeClinicalClaims(calibrationWarning, calculatorSource, fixture) {
  assert.equal(
    KBRC_CALIBRATION_WARNING_THRESHOLD,
    calibrationWarning.threshold_probability,
    "runtime calibration-warning threshold drifted from p0130",
  );
  assert.match(
    calculatorSource,
    /probability > KBRC_CALIBRATION_WARNING_THRESHOLD/,
    "runtime must apply the p0130 warning only above the source threshold",
  );
  assert.match(
    calculatorSource,
    /Estimates above 25% may overpredict major bleeding risk/,
    "runtime calibration-warning direction drifted from p0130",
  );
  assert.equal(
    KBRC_INPUT_LIMIT_PROVENANCE,
    "radulator-data-entry-guardrail",
    "runtime input-limit provenance must remain app-owned",
  );
  assert.match(
    calculatorSource,
    /data-entry guardrails, not ranges published as the model's validated domain/,
    "runtime must disclose that its numeric input limits are not publication-derived domains",
  );
  assert.doesNotMatch(
    calculatorSource,
    /supported entry range|source calculator's supported entry range|not extrapolated/i,
    "runtime must not attribute app input limits to the primary publication",
  );

  const warningVector = fixture.cases.find(({ id }) => id === "calibration-above-25");
  assert.ok(warningVector, "canonical fixture lacks calibration-above-25");
  const warningResult = computeKidneyBiopsyBleedingRisk(warningVector.inputs);
  assert.ok(
    warningResult._probability > calibrationWarning.threshold_probability,
    "calibration-above-25 must exercise a probability above the source threshold",
  );
  assert.match(
    warningResult["Calibration Warning"],
    /Estimates above 25% may overpredict major bleeding risk/,
    "calibration-above-25 runtime warning drifted from p0130",
  );
  const warningExpectation = warningVector.expect.fields.find(
    ({ key }) => key === "Calibration Warning",
  );
  assert.equal(
    warningExpectation?.includes,
    "Estimates above 25% may overpredict major bleeding risk",
    "calibration-above-25 fixture must bind the source-derived warning",
  );
}

function combinedCohortMedians(xml) {
  const table = xml.match(
    /<table-wrap\b[^>]*\bid="tbl1"[^>]*>[\s\S]*?<\/table-wrap>/,
  )?.[0];
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

// Weight-input evidence for the runtime "Input Review" output and info text. The source models
// BMI (kg/m2), not weight, as a continuous restricted-cubic-spline predictor with no cutoffs,
// mentions weight only where it lists weight and height as collected variables, and reports BMI
// only as a median (IQR). It publishes no weight or BMI validity domain, so the 30-130 kg interval
// is a Radulator entry-review aid, not a model claim. Each statement below must appear verbatim at
// its locator; the runtime is then bound at the old weight limits against an oracle evaluated from
// the Item S1 terms, and the binding must detect representative regressions.
const WEIGHT_XML_STATEMENTS = [
  {
    id: "derivation-variables-weight-height",
    paragraph: "p0030",
    text: "Variables used in the derivation of the bleeding risk prediction model included age, weight, height",
  },
  {
    id: "bmi-continuous-spline",
    paragraph: "p0050",
    text: "All continuous predictors (age, kidney length, preprocedural hemoglobin, platelet count, and BMI) were modeled as continuous variables using restricted cubic splines with 3 knots",
  },
  {
    id: "no-arbitrary-cutoffs",
    paragraph: "p0050",
    text: "No variables were dichotomized or categorized, and no arbitrary cutoffs were applied.",
  },
];
const WEIGHT_PDF_STATEMENTS = [
  { id: "item-s1-bmi-unit", page: 5, text: "BMI (body mass index) is expressed in kg/m2." },
  { id: "table-s1-title", page: 6, text: "Table S1: Predictor Modeling Approach" },
  {
    id: "table-s1-bmi-spline",
    page: 6,
    text: "Body mass index (kg/m2) Continuous, restricted cubic spline (3 knots)",
  },
];
const ANTHROPOMETRIC_TERM = String.raw`\bweigh\w*|\b(?:obes\w*|overweight|underweight)\b|\bkg\b(?!\s*\/\s*m)`;
const SUPPLEMENT_PAGE_COUNT = 7;
const WEIGHT_REVIEW_INTERVAL_KG = [30, 130];
const WEIGHT_REVIEW_PROBES_KG = [29.99, 30, 30.01, 129.99, 130, 130.01];
const RISK_KEY = "Estimated major bleeding risk after kidney biopsy";

function xmlParagraph(xml, id) {
  const paragraph = xml.match(new RegExp(`<p id="${id}">([\\s\\S]*?)</p>`))?.[1];
  assert.ok(paragraph, `full-text XML lacks paragraph ${id}`);
  return decodeXmlText(paragraph);
}

function assertXmlWeightEvidence(xml) {
  for (const { id, paragraph, text } of WEIGHT_XML_STATEMENTS) {
    assert.ok(
      xmlParagraph(xml, paragraph).includes(text),
      `full-text XML paragraph ${paragraph} lacks the ${id} statement: "${text}"`,
    );
  }

  // Closed world over the whole article (text, tables, captions and references): body weight,
  // obesity and kilogram values appear only where weight and height are listed as collected
  // variables, so the article states no weight range, limit or domain.
  const articleStart = xml.indexOf("<article");
  const articleEnd = xml.lastIndexOf("</article>");
  assert.ok(articleStart !== -1 && articleEnd > articleStart, "full-text XML lacks the article element");
  const articleText = decodeXmlText(xml.slice(articleStart, articleEnd));
  const anthropometricMentions = [...articleText.matchAll(new RegExp(ANTHROPOMETRIC_TERM, "gi"))];
  for (const mention of anthropometricMentions) {
    assert.match(
      articleText.slice(Math.max(0, mention.index - 5), mention.index + 15),
      /age, weight, height/,
      `the article mentions "${mention[0]}" outside a collected-variable list; re-review the weight-review interval against the source`,
    );
  }
  const weightMentions = [...xml.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)]
    .filter((match) => new RegExp(ANTHROPOMETRIC_TERM, "i").test(decodeXmlText(match[1])))
    .map((match) => {
      const id = match[0].match(/^<p\s[^>]*\bid="([^"]+)"/)?.[1];
      if (id) return id;
      return xml.lastIndexOf("<abstract", match.index) > xml.lastIndexOf("</abstract>", match.index)
        ? "abstract"
        : "unlabelled paragraph";
    });
  assert.deepEqual(
    weightMentions,
    ["abstract", "p0030"],
    "the article's weight mentions changed; re-review the weight-review interval against the source",
  );
  assert.equal(
    anthropometricMentions.length,
    weightMentions.length,
    "the article's weight mentions changed; re-review the weight-review interval against the source",
  );

  // Table 1 reports BMI as median (IQR) and has no weight or height row.
  const table = xml.match(/<table-wrap\b[^>]*\bid="tbl1"[^>]*>[\s\S]*?<\/table-wrap>/)?.[0];
  assert.ok(table, "full-text XML lacks Table 1");
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((match) =>
    [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) =>
      decodeXmlText(cell[1]),
    ),
  );
  const bmiRow = rows.find(([name]) => /^Body mass index \(kg\/m ?2 ?\)$/.test(name ?? ""));
  assert.ok(bmiRow, "Table 1 lacks the body mass index row");
  const combined = bmiRow.at(-1).match(/^(\d+\.\d+) \((\d+\.\d+)-(\d+\.\d+)\)$/);
  assert.ok(combined, `Table 1 combined BMI is not a median (IQR): ${bmiRow.at(-1)}`);
  const anthropometricRows = rows.filter(([name]) => /weight|height/i.test(name ?? ""));
  assert.equal(
    anthropometricRows.length,
    0,
    "Table 1 now reports weight or height; re-review the weight-review interval against the source",
  );
  const footnote = decodeXmlText(
    table.match(/<table-wrap-foot>([\s\S]*?)<\/table-wrap-foot>/)?.[1] ?? "",
  );
  assert.match(
    footnote,
    /Continuous variables are expressed as median \(IQR\)/,
    "Table 1 footnote no longer reports continuous variables as median (IQR)",
  );
  return {
    weightMentions,
    table1Bmi: { median: Number(combined[1]), iqr: [Number(combined[2]), Number(combined[3])] },
    anthropometricRows: anthropometricRows.length,
  };
}

function assertPdfWeightEvidence(supplementText, sourceTerms) {
  const pages = supplementText.split("\n");
  assert.equal(pages.length, SUPPLEMENT_PAGE_COUNT, "supplement PDF page count");
  const compact = (value) => value.replace(/\s+/g, "");
  for (const { id, page, text } of WEIGHT_PDF_STATEMENTS) {
    assert.ok(
      compact(pages[page - 1]).includes(compact(text)),
      `supplement PDF page ${page} lacks the ${id} statement: "${text}"`,
    );
  }
  for (const page of [5, 6]) {
    assert.doesNotMatch(
      pages[page - 1],
      /weight|height/i,
      `supplement PDF page ${page} now names weight or height as a model input`,
    );
  }
  const inputs = [...new Set(sourceTerms.map(({ input }) => input))].sort();
  assert.deepEqual(
    inputs,
    ["age", "bmi", "constant", "hemoglobin", "kidneySize", "native", "platelets"],
    "Item S1 predictors changed; weight must enter the model only through BMI",
  );
  return inputs.filter((input) => input !== "constant");
}

// Oracle evaluated directly from the parsed Item S1 terms, independent of the runtime function.
function sourceProbability(terms, vector) {
  let linearPredictor = 0;
  for (const { sign, coefficient, input, positive_part_cubic_knot: knot } of terms) {
    const value = input === "constant" ? 1 : Number(vector[input]);
    const basis = knot === undefined ? value : Math.max(value - knot, 0) ** 3;
    linearPredictor += (sign === "-" ? -coefficient : coefficient) * basis;
  }
  return 1 / (1 + Math.exp(-linearPredictor));
}

function assertWeightReviewBinding(compute, sourceTerms, example) {
  assert.equal(example?.id, "paper-lower-risk-allograft", "p0115 lower-risk example is missing");
  assert.equal(example.bmi, 30, "p0115 lower-risk example BMI drifted");
  const profile = {
    age: example.age,
    platelets: example.platelets,
    hemoglobin: example.hemoglobin,
    kidney_size: example.kidneySize,
    kidney_type: example.native ? "native" : "allograft",
  };
  const [low, high] = WEIGHT_REVIEW_INTERVAL_KG;
  const reviewFlags = WEIGHT_REVIEW_PROBES_KG.map((weight) => {
    const height = 170;
    const result = compute({ ...profile, weight, height });
    assert.equal(result.Error, undefined, `weight ${weight} kg must be estimated, not rejected`);
    const bmi = weight / (height / 100) ** 2;
    assert.ok(
      Math.abs(result._probability - sourceProbability(sourceTerms, { ...example, bmi })) <= 1e-12,
      `weight ${weight} kg: estimate must equal Item S1 at BMI ${bmi.toFixed(4)} (no clamp or cutoff)`,
    );
    const review = result["Input Review"];
    const outside = weight < low || weight > high;
    assert.equal(
      Boolean(review),
      outside,
      `weight ${weight} kg: Input Review must appear only outside ${low}-${high} kg`,
    );
    if (outside) {
      assert.match(review, /Radulator entry-review interval/, "review must attribute the interval to Radulator");
      assert.match(review, /not a validated model domain/, "review must not present the interval as a model domain");
      assert.match(review, /Check weight, height and units/, "review must ask for an entry check");
      assert.match(review, /clinical judgment/, "review must leave applicability to clinical judgment");
    }
    return outside;
  });

  // The published BMI-30 example keeps its displayed risk whether BMI 30 comes from 86.7 kg and
  // 170 cm or from 132.3 kg and 210 cm; only the weight outside the interval is reviewed.
  const pair = [[86.7, 170], [132.3, 210]].map(([weight, height]) =>
    compute({ ...profile, weight, height }),
  );
  for (const result of pair) {
    assert.equal(result.Error, undefined, "equal-BMI example must be estimated");
    assert.equal(result[RISK_KEY], example.display, "equal-BMI example drifted from the p0115 display");
    assert.ok(
      Math.abs(result._probability - sourceProbability(sourceTerms, example)) <= 1e-12,
      "equal-BMI example must equal Item S1 at BMI 30",
    );
  }
  assert.equal(pair[0]["Input Review"], undefined, "86.7 kg must not be reviewed");
  assert.ok(pair[1]["Input Review"], "132.3 kg must be reviewed");

  for (const weight of [0, -1]) {
    assert.match(
      compute({ ...profile, weight, height: 170 }).Error ?? "",
      /Weight must be above zero/,
      `weight ${weight} kg cannot form a BMI and must be rejected`,
    );
  }

  // Every other numeric entry limit remains an enforced Radulator guardrail.
  const base = { ...profile, weight: 86.7, height: 170 };
  for (const [field, { min, max, action }] of Object.entries(KBRC_INPUT_LIMITS)) {
    if (field === "weight") {
      assert.equal(action, "warn", "weight entry limits must review, not reject");
      continue;
    }
    assert.equal(action, undefined, `${field} entry limits must remain enforced`);
    for (const value of [min - 0.01, max + 0.01]) {
      assert.match(
        compute({ ...base, [field]: value }).Error ?? "",
        /not publication-derived model-validation bounds/,
        `${field} ${value} must be rejected`,
      );
    }
    for (const value of [min, max]) {
      assert.equal(compute({ ...base, [field]: value }).Error, undefined, `${field} ${value} must be accepted`);
    }
  }
  return reviewFlags;
}

function assertWeightReviewText(calculatorSource) {
  assert.match(
    calculatorSource,
    /BMI, not weight alone, is the model predictor/,
    "info text must identify BMI (Item S1, Table S1, p0050) as the predictor",
  );
  assert.match(
    calculatorSource,
    /Values outside 30–130 kg prompt an input-review warning rather than rejection/,
    "info text must describe the weight interval as review-only",
  );
}

// Representative regressions the weight binding must catch: the old hard cutoff, clamping, a
// missing review, and review wording that presents the interval as a model domain.
const WEIGHT_BINDING_REGRESSIONS = {
  "hard-weight-cutoff": (compute) => (values) =>
    Number(values.weight) < 30 || Number(values.weight) > 130
      ? { Error: "Weight must be 30–130 kg." }
      : compute(values),
  "weight-clamped": (compute) => (values) =>
    compute({ ...values, weight: Math.min(130, Math.max(30, Number(values.weight))) }),
  "input-review-removed": (compute) => (values) => {
    const result = { ...compute(values) };
    delete result["Input Review"];
    return result;
  },
  "input-review-claims-model-domain": (compute) => (values) => {
    const result = compute(values);
    return result["Input Review"]
      ? {
          ...result,
          "Input Review": result["Input Review"].replace(
            "not a validated model domain",
            "the validated model domain",
          ),
        }
      : result;
  },
};

function weightRegressionsDetected(compute, sourceTerms, example) {
  return Object.entries(WEIGHT_BINDING_REGRESSIONS).map(([id, mutate]) => {
    assert.throws(
      () => assertWeightReviewBinding(mutate(compute), sourceTerms, example),
      assert.AssertionError,
      `the weight-review binding did not detect the ${id} regression`,
    );
    return id;
  });
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

  const [xmlBytes, supplement] = await Promise.all([
    fetchBuffer(artifact.full_text_xml_url),
    fetchSupplement(artifact),
  ]);
  const xml = xmlBytes.toString("utf8");
  assert.match(xml, /<article-id pub-id-type="pmcid">PMC13156734<\/article-id>/);
  assert.match(xml, /CC BY-NC-ND license/);
  assert.match(xml, /xlink:href="mmc1\.pdf"/);

  const member = supplement.bytes;
  assert.equal(member.length, artifact.archive_member_bytes, "supplement member size");
  assert.equal(sha256(member), artifact.archive_member_sha256, "supplement member digest");
  const supplementText = await pdfText(member);
  const sourceTerms = parseSourceEquation(supplementText);
  const runtimeTerms = parseRuntimeEquation(calculatorBytes.toString("utf8"));
  assert.equal(sourceTerms.length, 22, "Item S1 equation term count");
  assert.deepEqual(runtimeTerms, sourceTerms, "runtime equation drifted from Item S1");

  const vectors = parsePublishedExamples(xml);
  assertRuntimeAndFixtures(vectors, fixture);
  const calibrationWarning = parseCalibrationWarning(xml);
  assertRuntimeClinicalClaims(
    calibrationWarning,
    calculatorBytes.toString("utf8"),
    fixture,
  );
  const modelInputs = assertPdfWeightEvidence(supplementText, sourceTerms);
  const xmlWeightEvidence = assertXmlWeightEvidence(xml);
  const lowerRiskExample = vectors.find(({ id }) => id === "paper-lower-risk-allograft");
  const reviewFlags = assertWeightReviewBinding(
    computeKidneyBiopsyBleedingRisk,
    sourceTerms,
    lowerRiskExample,
  );
  assertWeightReviewText(calculatorBytes.toString("utf8"));
  const regressionsDetected = weightRegressionsDetected(
    computeKidneyBiopsyBleedingRisk,
    sourceTerms,
    lowerRiskExample,
  );
  const inputLimitValues = Object.fromEntries(
    Object.entries(KBRC_INPUT_LIMITS).map(([field, { min, max, unit }]) => [
      field,
      { min, max, unit },
    ]),
  );
  const audit = {
    schema: "radulator-kbrc-primary-source-audit/v1",
    article_pmcid: "PMC13156734",
    archive_member: artifact.archive_member,
    direct_pdf_url: artifact.direct_pdf_url,
    supplement_retrieval: supplement.retrieval,
    archive_member_bytes: member.length,
    archive_member_sha256: sha256(member),
    license: "CC BY-NC-ND 4.0",
    equation_term_count: sourceTerms.length,
    source_example_displays: vectors.map(({ display }) => display),
    calibration_warning: calibrationWarning,
    runtime_calibration_warning_match: true,
    input_limits: {
      provenance: KBRC_INPUT_LIMIT_PROVENANCE,
      publication_derived: false,
      enforcement: Object.fromEntries(
        Object.entries(KBRC_INPUT_LIMITS).map(([field, { action }]) => [field, action || "reject"]),
      ),
      values: inputLimitValues,
    },
    runtime_input_limit_claims_match: true,
    weight_input_evidence: {
      model_inputs: modelInputs,
      xml_statements: WEIGHT_XML_STATEMENTS.map(({ paragraph, id }) => `${paragraph}:${id}`),
      pdf_statements: WEIGHT_PDF_STATEMENTS.map(({ page, id }) => `mmc1.pdf page ${page}:${id}`),
      weight_mentions: xmlWeightEvidence.weightMentions,
      table1_bmi_combined: xmlWeightEvidence.table1Bmi,
      table1_weight_or_height_rows: xmlWeightEvidence.anthropometricRows,
      publication_defines_weight_domain: false,
      review_interval_kg: WEIGHT_REVIEW_INTERVAL_KG,
      review_probes_kg: WEIGHT_REVIEW_PROBES_KG,
      review_flags: reviewFlags,
      equal_bmi_pair_display: lowerRiskExample.display,
      regressions_detected: regressionsDetected,
    },
    runtime_weight_review_match: true,
    runtime_equation_match: true,
    runtime_vector_match: true,
    fixture_vector_match: true,
    source_bytes_committed: false,
  };
  process.stdout.write(`${JSON.stringify(audit, null, process.argv.includes("--json") ? 0 : 2)}\n`);
}

await main();
