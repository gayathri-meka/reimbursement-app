"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getSavedCurrency, formatAmount } from "@/lib/currency";

interface ExpenseRow {
  vendor: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  documentIds: string[];
}

interface User {
  name: string;
  role: string;
}

export default function ReviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());
  const [currencySymbol, setCurrencySymbol] = useState(getSavedCurrency().symbol);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setUser);

    // Load extracted data from sessionStorage
    const raw = sessionStorage.getItem("extractedExpenses");
    if (raw) {
      const data = JSON.parse(raw);
      setExpenses(
        data.map(
          (d: { vendor: string | null; date: string | null; amount: number | null; description: string | null; documentId: string }) => ({
            vendor: d.vendor || "",
            date: d.date || "",
            amount: d.amount || 0,
            category: "general",
            description: d.description || "",
            documentIds: [d.documentId],
          })
        )
      );
    } else {
      // No data, redirect back to upload
      router.push("/employee/upload");
    }
  }, [router]);

  const updateExpense = (index: number, field: keyof ExpenseRow, value: string | number) => {
    setExpenses((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeExpense = (index: number) => {
    setExpenses((prev) => prev.filter((_, i) => i !== index));
  };

  const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const validate = (): boolean => {
    const missing = new Set<string>();
    expenses.forEach((e, i) => {
      if (!e.vendor) missing.add(`${i}-vendor`);
      if (!e.date) missing.add(`${i}-date`);
      if (!e.amount || e.amount <= 0) missing.add(`${i}-amount`);
    });
    setMissingFields(missing);
    return missing.size === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      setError("Please fill in all required fields highlighted in red.");
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await fetch("/api/reimbursements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenses }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "Submission failed");
      return;
    }

    // Clear session storage
    sessionStorage.removeItem("extractedExpenses");
    sessionStorage.removeItem("uploadedDocuments");
    router.push("/employee/dashboard");
  };

  if (!user) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen">
      <Navbar name={user.name} role={user.role} onCurrencyChange={setCurrencySymbol} />
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-bold mb-2">Review Expenses</h1>
        <p className="text-sm text-gray-500 mb-6">
          Verify extracted data and fill in any missing fields before submitting.
        </p>

        {expenses.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
            No expenses to review.{" "}
            <button
              onClick={() => router.push("/employee/upload")}
              className="text-blue-600 underline"
            >
              Upload files
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {expenses.map((exp, i) => (
                <div key={i} className="bg-white border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      Expense #{i + 1}
                    </span>
                    <button
                      onClick={() => removeExpense(i)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Vendor *
                      </label>
                      <input
                        value={exp.vendor}
                        onChange={(e) => updateExpense(i, "vendor", e.target.value)}
                        className={`w-full border rounded px-3 py-1.5 text-sm ${
                          missingFields.has(`${i}-vendor`)
                            ? "border-red-400 bg-red-50"
                            : "border-gray-300"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={exp.date}
                        onChange={(e) => updateExpense(i, "date", e.target.value)}
                        className={`w-full border rounded px-3 py-1.5 text-sm ${
                          missingFields.has(`${i}-date`)
                            ? "border-red-400 bg-red-50"
                            : "border-gray-300"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Amount *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={exp.amount || ""}
                        onChange={(e) =>
                          updateExpense(i, "amount", parseFloat(e.target.value) || 0)
                        }
                        className={`w-full border rounded px-3 py-1.5 text-sm ${
                          missingFields.has(`${i}-amount`)
                            ? "border-red-400 bg-red-50"
                            : "border-gray-300"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Category
                      </label>
                      <select
                        value={exp.category}
                        onChange={(e) => updateExpense(i, "category", e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                      >
                        <option value="general">General</option>
                        <option value="travel">Travel</option>
                        <option value="meals">Meals</option>
                        <option value="supplies">Supplies</option>
                        <option value="lodging">Lodging</option>
                        <option value="transport">Transport</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs text-gray-500 mb-1">
                      Description (optional)
                    </label>
                    <input
                      value={exp.description}
                      onChange={(e) => updateExpense(i, "description", e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                      placeholder="Brief description of the expense"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border rounded-lg p-4 flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-500">Total:</span>{" "}
                <span className="text-lg font-bold">{formatAmount(totalAmount, currencySymbol)}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push("/employee/upload")}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-green-600 text-white px-6 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mt-4 text-sm">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
