#!/usr/bin/env node
/**
 * Kinship In Motion — data validator
 * -----------------------------------
 * Checks the Excel workbook before the site is deployed, so a typo turns into a
 * clear error message instead of a silently broken graph. Runs in GitHub Actions
 * on every push. Reads the same two tabs the website reads: GLOSSARY and
 * RELATIONSHIPS, matching columns loosely so a header rename doesn't break it.
 *
 * Run locally with:   npm install xlsx@0.18.5 --no-save  &&  node validate.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as XLSX from "xlsx";

const ROOT = dirname(fileURLToPath(import.meta.url));
const WORKBOOK = "KINSHIP IN MOTION DATABASE_FOR_UPLOAD.xlsx";

/* ---- loose column matching (mirrors the website) ---- */
const GLOSSARY_COLS = {
  id: ["PERSON ID"], name: ["NAME"], other: ["OTHER NAMES"],
  ethnicity: ["ETHNICITY/NATIONALITY", "ETHNICITY", "NATIONALITY"],
  descriptors: ["PHYSICAL DESCRIPTORS", "DESCRIPTORS"],
  locations: ["LOCATION(S)", "LOCATIONS", "LOCATION"],
  bio: ["BIOGRAPHICAL INFORMATION", "BIOGRAPHY", "BIO"],
};
const REL_COLS = {
  src: ["PERSON ID"],
  label: ["RELATIONSHIP", "LABEL", "TYPE OF RELATIONSHIP", "RELATION"],
  targets: ["RELATION IDS", "RELATION ID", "RELATIONSHIP IDS"],
};
const normH = (h) => String(h || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
function resolveCols(headerRow, spec) {
  const map = new Map();
  headerRow.forEach((h, i) => { const n = normH(h); if (n && !map.has(n)) map.set(n, i); });
  const idx = {};
  for (const field in spec) {
    idx[field] = -1;
    for (const alias of spec[field]) { const n = normH(alias); if (map.has(n)) { idx[field] = map.get(n); break; } }
  }
  return idx;
}
const cell = (row, i) => (i >= 0 && i < row.length ? row[i] : "");

function main() {
  const errors = [];
  const warnings = [];

  let wb;
  try {
    wb = XLSX.read(readFileSync(join(ROOT, WORKBOOK)), { type: "buffer" });
  } catch (e) {
    console.error(`✖ Could not open "${WORKBOOK}" — ${e.message}`);
    process.exit(1);
  }

  const findSheet = (name) => {
    const key = wb.SheetNames.find((s) => String(s).trim().toUpperCase() === name);
    return key ? wb.Sheets[key] : null;
  };
  const gSheet = findSheet("GLOSSARY");
  const rSheet = findSheet("RELATIONSHIPS");
  if (!gSheet || !rSheet) {
    console.error(`✖ The workbook needs a GLOSSARY tab and a RELATIONSHIPS tab. Tabs found: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }

  const rowsOf = (sheet) => XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
  const gRows = rowsOf(gSheet);
  const rRows = rowsOf(rSheet);
  const gIdx = resolveCols(gRows[0] || [], GLOSSARY_COLS);
  const rIdx = resolveCols(rRows[0] || [], REL_COLS);

  if (gIdx.id < 0) errors.push('GLOSSARY tab: could not find a "PERSON ID" column.');
  if (rIdx.src < 0) errors.push('RELATIONSHIPS tab: could not find a "PERSON ID" column.');
  if (rIdx.targets < 0) errors.push('RELATIONSHIPS tab: could not find a "RELATION IDS" column.');
  if (rIdx.label < 0) warnings.push('RELATIONSHIPS tab: no relationship-type column found (looked for "RELATIONSHIP"/"Label") — every line will be uncolored.');
  if (errors.length) { report(0, 0, 0, warnings, errors); process.exit(1); }

  // --- glossary ---
  const people = new Map();
  const allIds = new Set();
  const seen = new Set();
  for (let i = 1; i < gRows.length; i++) {
    const id = norm(cell(gRows[i], gIdx.id));
    if (!id) continue;
    if (seen.has(id)) errors.push(`GLOSSARY row ${i + 1}: duplicate PERSON ID "${id}". IDs must be unique.`);
    seen.add(id); allIds.add(id);
    if (id.startsWith("P")) people.set(id, norm(cell(gRows[i], gIdx.name)));
  }

  // --- relationships ---
  let edgeCount = 0;
  const nodesInGraph = new Set();
  for (let i = 1; i < rRows.length; i++) {
    const row = rRows[i];
    if (!row.some((c) => norm(c) !== "")) continue; // blank spacer
    const targetsRaw = norm(cell(row, rIdx.targets));
    if (!targetsRaw) continue; // role/attribute row, not an edge
    const src = norm(cell(row, rIdx.src));
    const label = norm(cell(row, rIdx.label));
    if (!src) { errors.push(`RELATIONSHIPS row ${i + 1}: has a relation ID "${targetsRaw}" but no PERSON ID.`); continue; }
    if (!people.has(src)) {
      errors.push(`RELATIONSHIPS row ${i + 1}: source ${allIds.has(src) ? `"${src}" is a location, not a person` : `"${src}" is not in the glossary`}.`);
    }
    if (!label) warnings.push(`RELATIONSHIPS row ${i + 1}: relationship from "${src}" has no type — that line will be uncolored.`);
    for (const tid of targetsRaw.split(/[;,]/).map((t) => t.trim()).filter(Boolean)) {
      if (!people.has(tid)) {
        errors.push(`RELATIONSHIPS row ${i + 1}: relation ID ${allIds.has(tid) ? `"${tid}" is a location, not a person` : `"${tid}" is not in the glossary`} (type "${label || "?"}").`);
      } else {
        edgeCount++; nodesInGraph.add(src); nodesInGraph.add(tid);
      }
    }
  }

  [...nodesInGraph].sort().forEach((id) => {
    if (!people.get(id)) warnings.push(`Person "${id}" appears in a relationship but has no NAME in the glossary — it will show as "${id}".`);
  });

  report(people.size, edgeCount, nodesInGraph.size, warnings, errors);
  if (errors.length) process.exit(1);
}

function report(peopleN, edges, graphN, warnings, errors) {
  console.log("Kinship In Motion — data check");
  console.log("──────────────────────────────");
  console.log(`People in glossary : ${peopleN}`);
  console.log(`Valid relationships: ${edges}`);
  console.log(`People in the graph: ${graphN}`);
  console.log("");
  if (warnings.length) {
    console.log(`⚠  ${warnings.length} warning(s) (non-blocking):`);
    warnings.forEach((w) => console.log(`   - ${w}`));
    console.log("");
  }
  if (errors.length) {
    console.error(`✖ ${errors.length} error(s) — deployment blocked until fixed:`);
    errors.forEach((e) => console.error(`   - ${e}`));
    console.error("\nFix the rows above in the workbook and commit again.");
  } else {
    console.log("✓ All checks passed. Data is good to publish.");
  }
}

main();
