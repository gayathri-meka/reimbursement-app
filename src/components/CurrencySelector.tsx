"use client";

import { CURRENCIES, getSavedCurrency, saveCurrency } from "@/lib/currency";
import { useState } from "react";

interface Props {
  onChange: (symbol: string) => void;
}

export default function CurrencySelector({ onChange }: Props) {
  const [selected, setSelected] = useState(getSavedCurrency().code);

  const handleChange = (code: string) => {
    setSelected(code);
    saveCurrency(code);
    const currency = CURRENCIES.find((c) => c.code === code);
    onChange(currency?.symbol || "₹");
  };

  return (
    <select
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-600"
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.symbol} {c.code}
        </option>
      ))}
    </select>
  );
}
