#!/usr/bin/env node
/**
 * Kinship In Motion — data validator
 * -----------------------------------
 * Checks the two source CSVs before the site is deployed, so a typo in the
 * spreadsheet turns into a clear error message instead of a silently broken
 * graph. Runs in GitHub Actions on every push, and can be run locally with:
 *
 *     node scripts/validate.mjs
 *
 * No dependencies — it ships with its own small CSV parser so nothing needs
 * to be installed.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GLOSSARY = join(ROOT, "kim_glossary.csv");
const RELATIONSHIPS = join(ROOT, "kim_relationships.csv");

/* ------------------------------------------------------------------ */
/* Minimal RFC-4180 CSV parser (handles quoted fields, embedded commas */
/* and newlines, and "" escaped quotes).                              */
/* ------------------------------------------------------------------ */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  // strip a UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  // normalise line endings
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  // last field / row
  row.push(field);
  rows.push(row);
  return rows;
}

function toObjects(rows) {
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    o.__raw = r;
    return o;
  });
}

/* ------------------------------------------------------------------ */
/* Column names (kept in one place so a header rename is a one-liner)  */
/* ------------------------------------------------------------------ */
const COL = {
  gId: "PERSON ID",
  gName: "NAME",
  rSourceId: "PERSON ID",
  rSourceName: "Source",
  rLabel: "Label",
  rTargetIds: "RELATION IDS",
  rTargetName: "Target",
};

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */
function main() {
  const errors = [];
  const warnings = [];

  let glossaryRows, relRows;
  try {
    glossaryRows = toObjects(parseCSV(readFileSync(GLOSSARY, "utf8")));
  } catch (e) {
    console.error(`✖ Could not read kim_glossary.csv — ${e.message}`);
    process.exit(1);
  }
  try {
    relRows = toObjects(parseCSV(readFileSync(RELATIONSHIPS, "utf8")));
  } catch (e) {
    console.error(`✖ Could not read kim_relationships.csv — ${e.message}`);
    process.exit(1);
  }

  // --- glossary index -------------------------------------------------
  const people = new Map();       // id -> name  (P-prefixed only)
  const allIds = new Set();        // people + locations
  const seen = new Set();
  glossaryRows.forEach((row, idx) => {
    const id = row[COL.gId];
    if (!id) return; // blank spacer row
    const line = idx + 2; // +1 header, +1 to 1-index
    if (seen.has(id)) {
      errors.push(`Glossary: duplicate PERSON ID "${id}" (row ${line}). IDs must be unique.`);
    }
    seen.add(id);
    allIds.add(id);
    if (id.startsWith("P")) {
      people.set(id, row[COL.gName]);
    }
  });

  // --- relationships --------------------------------------------------
  let edgeCount = 0;
  const nodesInGraph = new Set();
  relRows.forEach((row, idx) => {
    const line = idx + 2;
    const hasContent = row.__raw.some((c) => (c ?? "").trim() !== "");
    if (!hasContent) return; // blank spacer row between people

    const srcId = row[COL.rSourceId];
    const targetIds = row[COL.rTargetIds];
    const label = row[COL.rLabel];

    // Rows with no RELATION ID are role/attribute tags (e.g. GARDENER),
    // not person-to-person edges. They are fine — just not edges.
    if (!targetIds) return;

    // it's an edge row → validate both ends
    if (!srcId) {
      errors.push(`Relationships (row ${line}): has a RELATION ID "${targetIds}" but no PERSON ID in the source column.`);
      return;
    }
    if (!people.has(srcId)) {
      const where = allIds.has(srcId)
        ? `"${srcId}" is a location, not a person`
        : `"${srcId}" is not in the glossary`;
      errors.push(`Relationships (row ${line}): source ${where}.`);
    }
    if (!label) {
      warnings.push(`Relationships (row ${line}): edge from "${srcId}" has no relationship Label.`);
    }

    const targets = targetIds.split(/[;,]/).map((t) => t.trim()).filter(Boolean);
    targets.forEach((tid) => {
      if (!people.has(tid)) {
        const where = allIds.has(tid)
          ? `"${tid}" is a location, not a person`
          : `"${tid}" is not in the glossary`;
        errors.push(`Relationships (row ${line}): relation ID ${where} (label "${label || "?"}").`);
      } else {
        edgeCount++;
        nodesInGraph.add(srcId);
        nodesInGraph.add(tid);
      }
    });
  });

  // Warn only about missing names for people who actually appear in the
  // graph — a nameless person no relationship points to is harmless.
  [...nodesInGraph].sort().forEach((id) => {
    if (!people.get(id)) {
      warnings.push(`Person "${id}" appears in a relationship but has no NAME in the glossary — it will show as "${id}" in the graph.`);
    }
  });

  /* --- report ------------------------------------------------------ */
  console.log("Kinship In Motion — data check");
  console.log("──────────────────────────────");
  console.log(`People in glossary : ${people.size}`);
  console.log(`Valid relationships: ${edgeCount}`);
  console.log(`People in the graph: ${nodesInGraph.size}`);
  console.log("");

  if (warnings.length) {
    console.log(`⚠  ${warnings.length} warning(s) (non-blocking):`);
    warnings.forEach((w) => console.log(`   - ${w}`));
    console.log("");
  }

  if (errors.length) {
    console.error(`✖ ${errors.length} error(s) — deployment blocked until fixed:`);
    errors.forEach((e) => console.error(`   - ${e}`));
    console.error("\nFix the CSV rows above and commit again.");
    process.exit(1);
  }

  console.log("✓ All checks passed. Data is good to publish.");
}

main();
