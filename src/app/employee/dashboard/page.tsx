"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getSavedCurrency, formatAmount } from "@/lib/currency";

interface Reimbursement {
  id: string;
  status: string;
  totalAmount: number;
  submittedAt: string | null;
  createdAt: string;
  expenses: { vendor: string; amount: number }[];
}

interface User {
  name: string;
  role: string;
  designation: string | null;
}

export default function EmployeeDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState(getSavedCurrency().symbol);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setUser);
    fetch("/api/reimbursements")
      .then((r) => r.json())
      .then(setReimbursements);
  }, []);

  const statusColor: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    SUBMITTED: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  };

  if (!user) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen">
      <Navbar name={user.name} role={user.role} onCurrencyChange={setCurrencySymbol} />
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">My Reimbursements</h1>
            {user.designation && (
              <p className="text-sm text-gray-500">Designation: {user.designation}</p>
            )}
          </div>
          <button
            onClick={() => router.push("/employee/upload")}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            New Claim
          </button>
        </div>

        {reimbursements.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
            No reimbursements yet. Click &quot;New Claim&quot; to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {reimbursements.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-lg border p-4 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${statusColor[r.status]}`}>
                      {r.status}
                    </span>
                    <span className="text-sm font-medium">
                      {formatAmount(r.totalAmount, currencySymbol)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {r.expenses.length} expense(s) &middot;{" "}
                    {new Date(r.submittedAt || r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <a
                  href={`/api/reimbursements/${r.id}/pdf`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Download PDF
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
