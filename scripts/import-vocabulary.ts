#!/usr/bin/env tsx
/**
 * CSV Vocabulary Importer
 *
 * Imports vocabulary words and replacement rules into the Amical SQLite database.
 * Uses sqlite3 CLI (available on macOS/Linux by default) to avoid native binding issues.
 *
 * CSV Format:
 *   word1,word2:replacement   - Multiple source words mapping to one replacement
 *   word:replacement          - Single replacement rule
 *   word                      - Vocabulary word (no replacement)
 *   # comment                 - Ignored
 *
 * Examples:
 *   かぐら,神楽:CAGRA         → 2 records: かぐら→CAGRA, 神楽→CAGRA
 *   JIRA:Jira                 → 1 record: JIRA→Jira
 *   TypeScript                → 1 record: TypeScript (vocabulary only)
 *
 * Usage:
 *   pnpm tsx scripts/import-vocabulary.ts <csv-file>
 *   pnpm tsx scripts/import-vocabulary.ts --dry-run <csv-file>
 *   pnpm tsx scripts/import-vocabulary.ts --db /path/to/amical.db <csv-file>
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

interface VocabularyRecord {
  word: string;
  replacementWord: string | null;
  isReplacement: boolean;
}

function getDefaultDbPath(): string {
  const platform = process.platform;
  let userDataPath: string;

  if (platform === "darwin") {
    userDataPath = path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Amical",
    );
  } else if (platform === "win32") {
    userDataPath = path.join(os.homedir(), "AppData", "Roaming", "Amical");
  } else {
    userDataPath = path.join(os.homedir(), ".config", "Amical");
  }

  return path.join(userDataPath, "amical.db");
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

function parseCsvLine(line: string): VocabularyRecord[] {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return [];

  const colonIndex = trimmed.lastIndexOf(":");
  if (colonIndex === -1) {
    // No replacement - vocabulary word only
    return [
      { word: trimmed, replacementWord: null, isReplacement: false },
    ];
  }

  const sourcesPart = trimmed.substring(0, colonIndex);
  const replacement = trimmed.substring(colonIndex + 1).trim();

  if (!replacement) {
    return [
      {
        word: sourcesPart.trim(),
        replacementWord: null,
        isReplacement: false,
      },
    ];
  }

  // Split source words by comma
  const sources = sourcesPart
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return sources.map((word) => ({
    word,
    replacementWord: replacement,
    isReplacement: true,
  }));
}

function parseCsvFile(filePath: string): VocabularyRecord[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const records: VocabularyRecord[] = [];

  for (const line of lines) {
    records.push(...parseCsvLine(line));
  }

  return records;
}

function runSqlite3(dbPath: string, sqlFile: string): string {
  return execFileSync("sqlite3", [dbPath, `.read ${sqlFile}`], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function importVocabulary(
  dbPath: string,
  records: VocabularyRecord[],
  dryRun: boolean,
): void {
  if (dryRun) {
    console.log("\n[Dry Run] The following records would be imported:\n");
    for (const record of records) {
      if (record.isReplacement) {
        console.log(`  ${record.word} → ${record.replacementWord}`);
      } else {
        console.log(`  ${record.word}`);
      }
    }
    console.log(`\nTotal: ${records.length} records`);
    return;
  }

  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    console.error(
      "Make sure Amical has been launched at least once to create the database.",
    );
    process.exit(1);
  }

  // Build SQL statements
  const statements = records.map((record) => {
    const word = escapeSQL(record.word);
    const replacement = record.replacementWord
      ? `'${escapeSQL(record.replacementWord)}'`
      : "NULL";
    const isReplacement = record.isReplacement ? 1 : 0;

    return `INSERT OR IGNORE INTO vocabulary (word, replacement_word, is_replacement, date_added, usage_count, created_at, updated_at) VALUES ('${word}', ${replacement}, ${isReplacement}, unixepoch(), 0, unixepoch(), unixepoch());`;
  });

  const sql = `BEGIN TRANSACTION;\n${statements.join("\n")}\nCOMMIT;`;

  // Write SQL to temp file to handle large imports
  const tmpFile = path.join(os.tmpdir(), `amical-import-${Date.now()}.sql`);
  fs.writeFileSync(tmpFile, sql, "utf-8");

  try {
    const output = runSqlite3(dbPath, tmpFile);
    if (output) console.log(output);

    // Count recently inserted records
    const countResult = execFileSync(
      "sqlite3",
      [dbPath, "SELECT COUNT(*) FROM vocabulary WHERE created_at >= unixepoch() - 5;"],
      { encoding: "utf-8" },
    ).trim();

    console.log(`\nImport complete: ${countResult} records in database (recent)`);
    console.log(`(Duplicates were skipped via INSERT OR IGNORE)`);
  } catch (error: any) {
    console.error("Import failed:", error.stderr || error.message);
    process.exit(1);
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

// Main
function main() {
  const args = process.argv.slice(2);
  let dryRun = false;
  let dbPath: string | null = null;
  let csvFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--db" && i + 1 < args.length) {
      dbPath = args[++i];
    } else {
      csvFile = args[i];
    }
  }

  if (!csvFile) {
    console.log(
      "Usage: pnpm tsx scripts/import-vocabulary.ts [--dry-run] [--db <path>] <csv-file>",
    );
    console.log("");
    console.log("CSV Format:");
    console.log("  かぐら,神楽:CAGRA    → 2 replacement records");
    console.log("  JIRA:Jira            → 1 replacement record");
    console.log("  TypeScript           → 1 vocabulary word");
    console.log("  # comment            → ignored");
    process.exit(1);
  }

  if (!fs.existsSync(csvFile)) {
    console.error(`File not found: ${csvFile}`);
    process.exit(1);
  }

  if (!dbPath) {
    dbPath = getDefaultDbPath();
  }

  console.log(`CSV file: ${csvFile}`);
  console.log(`Database: ${dbPath}`);

  const records = parseCsvFile(csvFile);

  if (records.length === 0) {
    console.log("No records found in CSV file.");
    process.exit(0);
  }

  console.log(`Parsed ${records.length} records from CSV`);
  importVocabulary(dbPath, records, dryRun);
}

main();
