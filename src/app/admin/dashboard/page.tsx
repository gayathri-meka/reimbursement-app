"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { getSavedCurrency, formatAmount } from "@/lib/currency";

interface Employee {
  id: string;
  name: string;
  email: string;
  designation: string | null;
}

interface Reimbursement {
  id: string;
  status: string;
  totalAmount: number;
  submittedAt: string | null;
  createdAt: string;
  employee: { name: string; email: string; designation: { name: string } | null };
  expenses: { vendor: string; amount: number; date: string; category: string }[];
}

interface User {
  name: string;
  role: string;
}

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tab, setTab] = useState<"submissions" | "employees">("submissions");

  // New employee form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDesignation, setNewDesignation] = useState("");
  const [designations, setDesignations] = useState<{ id: string; name: string }[]>([]);
  const [formMsg, setFormMsg] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState(getSavedCurrency().symbol);

  const fetchData = () => {
    fetch("/api/auth/me").then((r) => r.json()).then(setUser);
    fetch("/api/reimbursements").then((r) => r.json()).then(setReimbursements);
    fetch("/api/employees").then((r) => r.json()).then(setEmployees);
    fetch("/api/designations").then((r) => r.json()).then(setDesignations);
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (id: string) => {
    await fetch(`/api/reimbursements/${id}/approve`, { method: "POST" });
    fetchData();
  };

  const handleReject = async (id: string) => {
    await fetch(`/api/reimbursements/${id}/reject`, { method: "POST" });
    fetchData();
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg("");
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        email: newEmail,
        password: newPassword,
        designationId: newDesignation || undefined,
      }),
    });
    if (res.ok) {
      setFormMsg("Employee created");
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewDesignation("");
      fetchData();
    } else {
      const data = await res.json();
      setFormMsg(data.error || "Failed");
    }
  };

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
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setTab("submissions")}
            className={`px-4 py-2 text-sm rounded ${
              tab === "submissions"
                ? "bg-blue-600 text-white"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            Submissions
          </button>
          <button
            onClick={() => setTab("employees")}
            className={`px-4 py-2 text-sm rounded ${
              tab === "employees"
                ? "bg-blue-600 text-white"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            Employees
          </button>
          <a
            href="/admin/limits"
            className="px-4 py-2 text-sm rounded bg-white border text-gray-600 hover:bg-gray-50"
          >
            Limits
          </a>
        </div>

        {tab === "submissions" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Reimbursement Submissions</h2>
            {reimbursements.length === 0 ? (
              <div className="bg-white border rounded-lg p-6 text-center text-gray-500">
                No submissions yet.
              </div>
            ) : (
              reimbursements.map((r) => (
                <div key={r.id} className="bg-white border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-sm">{r.employee.name}</span>
                      <span className="text-xs text-gray-500 ml-2">{r.employee.email}</span>
                      {r.employee.designation && (
                        <span className="text-xs text-gray-400 ml-2">
                          ({r.employee.designation.name})
                        </span>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${statusColor[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    {r.expenses.map((exp, i) => (
                      <span key={i}>
                        {exp.vendor} ({formatAmount(exp.amount, currencySymbol)})
                        {i < r.expenses.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      Total: {formatAmount(r.totalAmount, currencySymbol)}
                    </span>
                    <div className="flex gap-2">
                      <a
                        href={`/api/reimbursements/${r.id}/pdf`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        PDF
                      </a>
                      {r.status === "SUBMITTED" && (
                        <>
                          <button
                            onClick={() => handleApprove(r.id)}
                            className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(r.id)}
                            className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "employees" && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Manage Employees</h2>
            <form onSubmit={handleAddEmployee} className="bg-white border rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium mb-3">Add Employee</h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
                <input
                  placeholder="Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                  required
                />
                <select
                  value={newDesignation}
                  onChange={(e) => setNewDesignation(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                >
                  <option value="">No designation</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700"
                >
                  Add
                </button>
                {formMsg && <span className="text-sm text-gray-600">{formMsg}</span>}
              </div>
            </form>

            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Email</th>
                    <th className="px-4 py-2 font-medium">Designation</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-t">
                      <td className="px-4 py-2">{emp.name}</td>
                      <td className="px-4 py-2 text-gray-500">{emp.email}</td>
                      <td className="px-4 py-2 text-gray-500">{emp.designation || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
