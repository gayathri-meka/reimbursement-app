"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getSavedCurrency, formatAmount } from "@/lib/currency";

interface UploadedDoc {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
}

interface ExtractedItem {
  vendor: string | null;
  date: string | null;
  amount: number | null;
  description: string | null;
  documentId: string;
  fileName: string;
}

interface User {
  name: string;
  role: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [extracted, setExtracted] = useState<ExtractedItem[]>([]);
  const [error, setError] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState(getSavedCurrency().symbol);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setUser);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError("");

    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append("files", file);
    }

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let msg = "Upload failed";
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch { /* response may not be JSON */ }
        throw new Error(msg);
      }

      const { documents: docs } = await res.json();
      setDocuments(docs);

      // Run OCR on each uploaded document
      setExtracting(true);
      const allItems: ExtractedItem[] = [];

      for (const doc of docs) {
        try {
          const ocrRes = await fetch("/api/documents/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileUrl: doc.fileUrl }),
          });
          const ocrData = await ocrRes.json();

          // OCR now returns { expenses: [...] } — an array of items per document
          const expenses = ocrData.expenses || [];
          for (const exp of expenses) {
            allItems.push({
              ...exp,
              documentId: doc.id,
              fileName: doc.fileName,
            });
          }
        } catch {
          allItems.push({
            vendor: null,
            date: null,
            amount: null,
            description: null,
            documentId: doc.id,
            fileName: doc.fileName,
          });
        }
      }

      setExtracted(allItems);
      setExtracting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleProceed = () => {
    sessionStorage.setItem("extractedExpenses", JSON.stringify(extracted));
    sessionStorage.setItem("uploadedDocuments", JSON.stringify(documents));
    router.push("/employee/review");
  };

  if (!user) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen">
      <Navbar name={user.name} role={user.role} onCurrencyChange={setCurrencySymbol} />
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold mb-6">Upload Expense Proofs</h1>

        <div className="bg-white rounded-lg border p-6 mb-6">
          <label className="block">
            <span className="text-sm font-medium">
              Select receipts, bills, or invoices
            </span>
            <p className="text-xs text-gray-500 mb-3">
              Supports images (JPG, PNG) and PDFs. You can select multiple
              files. Documents with multiple items will be extracted
              automatically.
            </p>
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={handleUpload}
              disabled={uploading || extracting}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {uploading && (
          <div className="text-sm text-gray-500 mb-4">Uploading files...</div>
        )}

        {extracting && (
          <div className="text-sm text-blue-600 mb-4">
            Extracting data from receipts using OCR...
          </div>
        )}

        {extracted.length > 0 && !extracting && (
          <div className="space-y-3 mb-6">
            <h2 className="text-sm font-semibold text-gray-700">
              Extracted {extracted.length} expense(s)
            </h2>
            {extracted.map((item, i) => (
              <div key={i} className="bg-white border rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-2">
                  From: {item.fileName}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Vendor:</span>{" "}
                    <span className={item.vendor ? "" : "text-red-500"}>
                      {item.vendor || "Not detected"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Date:</span>{" "}
                    <span className={item.date ? "" : "text-red-500"}>
                      {item.date || "Not detected"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Amount:</span>{" "}
                    <span className={item.amount !== null ? "" : "text-red-500"}>
                      {item.amount !== null ? formatAmount(item.amount, currencySymbol) : "Not detected"}
                    </span>
                  </div>
                  {item.description && (
                    <div>
                      <span className="text-gray-500">Desc:</span>{" "}
                      {item.description}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button
              onClick={handleProceed}
              className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700"
            >
              Review &amp; Submit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
