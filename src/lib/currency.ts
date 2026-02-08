export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: Currency[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
];

const STORAGE_KEY = "app-currency";

export function getDefaultCurrency(): Currency {
  return CURRENCIES[0]; // INR
}

export function getSavedCurrency(): Currency {
  if (typeof window === "undefined") return getDefaultCurrency();
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const found = CURRENCIES.find((c) => c.code === saved);
    if (found) return found;
  }
  return getDefaultCurrency();
}

export function saveCurrency(code: string) {
  localStorage.setItem(STORAGE_KEY, code);
}

export function formatAmount(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
