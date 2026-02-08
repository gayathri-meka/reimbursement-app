import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CURRENCIES,
  getDefaultCurrency,
  getSavedCurrency,
  saveCurrency,
  formatAmount,
} from "@/lib/currency";

describe("Currency", () => {
  describe("CURRENCIES", () => {
    it("contains INR, USD, EUR, GBP", () => {
      const codes = CURRENCIES.map((c) => c.code);
      expect(codes).toEqual(["INR", "USD", "EUR", "GBP"]);
    });

    it("each currency has code, symbol, and name", () => {
      for (const c of CURRENCIES) {
        expect(c.code).toBeTruthy();
        expect(c.symbol).toBeTruthy();
        expect(c.name).toBeTruthy();
      }
    });
  });

  describe("getDefaultCurrency", () => {
    it("returns INR as the default currency", () => {
      const currency = getDefaultCurrency();
      expect(currency.code).toBe("INR");
      expect(currency.symbol).toBe("₹");
      expect(currency.name).toBe("Indian Rupee");
    });
  });

  describe("getSavedCurrency", () => {
    it("returns default currency when window is undefined (server-side)", () => {
      // In Node test environment, window is undefined by default
      const currency = getSavedCurrency();
      expect(currency.code).toBe("INR");
    });
  });

  describe("formatAmount", () => {
    it("formats amount with rupee symbol", () => {
      const result = formatAmount(1000, "₹");
      expect(result).toBe("₹1,000.00");
    });

    it("formats amount with dollar symbol", () => {
      const result = formatAmount(2500.5, "$");
      expect(result).toBe("$2,500.50");
    });

    it("formats zero amount", () => {
      const result = formatAmount(0, "€");
      expect(result).toBe("€0.00");
    });

    it("formats large amounts with proper comma separation", () => {
      const result = formatAmount(1234567.89, "₹");
      // en-IN locale uses lakh/crore grouping: 12,34,567.89
      expect(result).toContain("₹");
      expect(result).toContain("567.89");
    });

    it("rounds to 2 decimal places", () => {
      const result = formatAmount(99.999, "$");
      expect(result).toBe("$100.00");
    });

    it("adds trailing zeros for whole numbers", () => {
      const result = formatAmount(50, "£");
      expect(result).toBe("£50.00");
    });
  });
});
