/**
 * OCR Test Script
 *
 * Tests the extractExpenseData function against sample bills in /samples/bills.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx tsx scripts/test-ocr.ts
 *
 * Or if OPENAI_API_KEY is in your .env:
 *   npx tsx scripts/test-ocr.ts
 */

import fs from "fs";
import path from "path";
import { config } from "dotenv";

// Load .env file
config();

// Import OCR function directly
import { extractExpenseData } from "../src/lib/ocr";

const SAMPLES_DIR = path.resolve(__dirname, "../samples/bills");

async function main() {
  console.log("=== OCR Extraction Test ===\n");

  if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY environment variable is not set.");
    console.error("Set it in .env or pass it directly:");
    console.error("  OPENAI_API_KEY=sk-... npx tsx scripts/test-ocr.ts\n");
    process.exit(1);
  }

  if (!fs.existsSync(SAMPLES_DIR)) {
    console.error(`ERROR: Samples directory not found: ${SAMPLES_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SAMPLES_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return [".pdf", ".jpg", ".jpeg", ".png", ".webp"].includes(ext);
  });

  if (files.length === 0) {
    console.error("No sample files found in", SAMPLES_DIR);
    process.exit(1);
  }

  console.log(`Found ${files.length} sample file(s):\n`);

  for (const file of files) {
    const filePath = path.join(SAMPLES_DIR, file);
    console.log(`=== ${file} ===`);
    console.log(`Path: ${filePath}\n`);

    try {
      const results = await extractExpenseData(filePath);
      console.log(`Extracted ${results.length} expense(s):\n`);

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        console.log(`  [${i + 1}]`);
        console.log(`    Vendor:      ${r.vendor || "(not detected)"}`);
        console.log(`    Date:        ${r.date || "(not detected)"}`);
        console.log(`    Amount:      ${r.amount !== null ? r.amount : "(not detected)"}`);
        console.log(`    Description: ${r.description || "(none)"}`);

        const issues = [];
        if (!r.vendor) issues.push("vendor");
        if (!r.date) issues.push("date");
        if (r.amount === null) issues.push("amount");

        console.log(
          `    Status:      ${issues.length === 0 ? "PASS" : `PARTIAL (missing: ${issues.join(", ")})`}`
        );
        console.log();
      }
    } catch (error) {
      console.log(`  FAIL: ${error instanceof Error ? error.message : error}\n`);
    }
  }

  console.log("=== Test Complete ===");
}

main();
