"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { getSavedCurrency, formatAmount } from "@/lib/currency";

interface Designation {
  id: string;
  name: string;
}

interface Limit {
  id: string;
  designationId: string;
  designation: { name: string };
  category: string;
  maxAmount: number;
  period: string;
}

interface User {
  name: string;
  role: string;
}

export default function LimitsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [limits, setLimits] = useState<Limit[]>([]);
  const [newDesName, setNewDesName] = useState("");

  // Limit form
  const [selDesignation, setSelDesignation] = useState("");
  const [category, setCategory] = useState("general");
  const [maxAmount, setMaxAmount] = useState("");
  const [period, setPeriod] = useState("monthly");
  const [msg, setMsg] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState(getSavedCurrency().symbol);

  const fetchData = () => {
    fetch("/api/auth/me").then((r) => r.json()).then(setUser);
    fetch("/api/designations").then((r) => r.json()).then(setDesignations);
    fetch("/api/limits").then((r) => r.json()).then(setLimits);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesName.trim()) return;
    await fetch("/api/designations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newDesName }),
    });
    setNewDesName("");
    fetchData();
  };

  const handleAddLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/limits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        designationId: selDesignation,
        category,
        maxAmount: parseFloat(maxAmount),
        period,
      }),
    });
    if (res.ok) {
      setMsg("Limit saved");
      setMaxAmount("");
      fetchData();
    } else {
      const data = await res.json();
      setMsg(data.error || "Failed");
    }
  };

  if (!user) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen">
      <Navbar name={user.name} role={user.role} onCurrencyChange={setCurrencySymbol} />
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <a
            href="/admin/dashboard"
            className="text-sm text-blue-600 hover:underline"
          >
            &larr; Dashboard
          </a>
          <h1 className="text-xl font-bold">Designations &amp; Limits</h1>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Designations */}
          <div>
            <h2 className="text-sm font-semibold mb-3">Designations</h2>
            <form onSubmit={handleAddDesignation} className="flex gap-2 mb-3">
              <input
                placeholder="e.g. Senior Engineer"
                value={newDesName}
                onChange={(e) => setNewDesName(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
              >
                Add
              </button>
            </form>
            <div className="bg-white border rounded-lg overflow-hidden">
              {designations.map((d) => (
                <div key={d.id} className="px-4 py-2 border-b last:border-b-0 text-sm">
                  {d.name}
                </div>
              ))}
              {designations.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-400">No designations yet.</div>
              )}
            </div>
          </div>

          {/* Add Limit */}
          <div>
            <h2 className="text-sm font-semibold mb-3">Set Limit</h2>
            <form onSubmit={handleAddLimit} className="bg-white border rounded-lg p-4 space-y-3">
              <select
                value={selDesignation}
                onChange={(e) => setSelDesignation(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              >
                <option value="">Select designation</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                <option value="general">General</option>
                <option value="travel">Travel</option>
                <option value="meals">Meals</option>
                <option value="supplies">Supplies</option>
                <option value="lodging">Lodging</option>
                <option value="transport">Transport</option>
                <option value="total">Total (overall cap)</option>
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Max amount"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-1.5 rounded text-sm w-full hover:bg-green-700"
              >
                Save Limit
              </button>
              {msg && <p className="text-sm text-gray-600">{msg}</p>}
            </form>
          </div>
        </div>

        {/* Current Limits Table */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold mb-3">Current Limits</h2>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Designation</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Max Amount</th>
                  <th className="px-4 py-2 font-medium">Period</th>
                </tr>
              </thead>
              <tbody>
                {limits.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-4 py-2">{l.designation.name}</td>
                    <td className="px-4 py-2">{l.category}</td>
                    <td className="px-4 py-2">{formatAmount(l.maxAmount, currencySymbol)}</td>
                    <td className="px-4 py-2 text-gray-500">{l.period}</td>
                  </tr>
                ))}
                {limits.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-gray-400 text-center">
                      No limits configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
