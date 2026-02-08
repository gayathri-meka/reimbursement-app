"use client";

import { useRouter } from "next/navigation";
import CurrencySelector from "./CurrencySelector";

interface NavbarProps {
  name: string;
  role: string;
  onCurrencyChange?: (symbol: string) => void;
}

export default function Navbar({ name, role, onCurrencyChange }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-lg">Reimbursement App</span>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
          {role}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <CurrencySelector onChange={onCurrencyChange || (() => {})} />
        <span className="text-sm text-gray-600">{name}</span>
        <button
          onClick={handleLogout}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
