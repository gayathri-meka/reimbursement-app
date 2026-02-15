import { describe, it, expect } from "vitest";
import { extractExpenseData } from "@/lib/ocr";
import path from "path";

describe("OCR Extraction Pipeline", () => {
  const samplesDir = path.join(process.cwd(), "samples", "bills");

  it("extracts expense data from bill-1.jpeg (single receipt)", async () => {
    const result = await extractExpenseData(path.join(samplesDir, "bill-1.jpeg"));

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);

    // Each item should have the required fields
    for (const item of result) {
      expect(item).toHaveProperty("vendor");
      expect(item).toHaveProperty("date");
      expect(item).toHaveProperty("amount");
      expect(item).toHaveProperty("description");
    }

    // At least some items should have non-null values
    const withVendor = result.filter((r) => r.vendor !== null);
    expect(withVendor.length).toBeGreaterThan(0);

    const withAmount = result.filter((r) => r.amount !== null);
    expect(withAmount.length).toBeGreaterThan(0);

    // Amounts should be numbers
    for (const item of withAmount) {
      expect(typeof item.amount).toBe("number");
      expect(item.amount!).toBeGreaterThan(0);
    }
  });

  it("extracts expense data from bill-2.jpeg (single receipt)", async () => {
    const result = await extractExpenseData(path.join(samplesDir, "bill-2.jpeg"));

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);

    const withAmount = result.filter((r) => r.amount !== null);
    expect(withAmount.length).toBeGreaterThan(0);
  });

  it("returns the correct ExtractedExpense shape", async () => {
    const result = await extractExpenseData(path.join(samplesDir, "bill-1.jpeg"));

    for (const item of result) {
      // Each field is either the expected type or null
      expect(item.vendor === null || typeof item.vendor === "string").toBe(true);
      expect(item.date === null || typeof item.date === "string").toBe(true);
      expect(item.amount === null || typeof item.amount === "number").toBe(true);
      expect(item.description === null || typeof item.description === "string").toBe(true);
    }
  });
});
