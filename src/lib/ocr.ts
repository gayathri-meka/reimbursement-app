import OpenAI from "openai";
import fs from "fs";
import path from "path";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export interface ExtractedExpense {
  vendor: string | null;
  date: string | null;
  amount: number | null;
  description: string | null;
}

/**
 * Check if a URL or path points to a PDF based on the extension.
 */
function isPdf(urlOrPath: string): boolean {
  const cleaned = urlOrPath.split("?")[0].split("#")[0];
  return cleaned.toLowerCase().endsWith(".pdf");
}

/**
 * Download a file from a URL and return its contents as a Buffer.
 */
async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Build content parts for the OpenAI Chat API.
 * - Images (local or remote) are sent as image_url parts.
 * - PDFs are sent as file parts with base64 data (no pdftoppm needed).
 */
async function buildContentParts(
  fileUrlOrPath: string
): Promise<OpenAI.Chat.Completions.ChatCompletionContentPart[]> {
  const isRemote =
    fileUrlOrPath.startsWith("http://") ||
    fileUrlOrPath.startsWith("https://");

  // --- PDF handling (works on Vercel — no CLI tools needed) ---
  if (isPdf(fileUrlOrPath)) {
    let base64: string;
    let filename: string;

    if (isRemote) {
      const buffer = await downloadFile(fileUrlOrPath);
      base64 = buffer.toString("base64");
      filename = fileUrlOrPath.split("/").pop()?.split("?")[0] || "document.pdf";
    } else {
      const absolutePath = path.resolve(fileUrlOrPath);
      base64 = fs.readFileSync(absolutePath).toString("base64");
      filename = path.basename(absolutePath);
    }

    return [
      {
        type: "file" as const,
        file: {
          file_data: `data:application/pdf;base64,${base64}`,
          filename,
        },
      } as OpenAI.Chat.Completions.ChatCompletionContentPart,
    ];
  }

  // --- Image handling ---
  if (isRemote) {
    return [
      {
        type: "image_url",
        image_url: { url: fileUrlOrPath, detail: "high" },
      },
    ];
  }

  // Local image file
  const absolutePath = path.resolve(fileUrlOrPath);
  const ext = path.extname(absolutePath).toLowerCase();
  const fileBuffer = fs.readFileSync(absolutePath);
  const base64 = fileBuffer.toString("base64");

  let mimeType = "image/png";
  if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
  else if (ext === ".webp") mimeType = "image/webp";

  return [
    {
      type: "image_url",
      image_url: {
        url: `data:${mimeType};base64,${base64}`,
        detail: "high" as const,
      },
    },
  ];
}

const SYSTEM_PROMPT = `You are an expense receipt data extractor. You will receive one or more images that may contain:
- A single receipt/bill/invoice
- A reimbursement form with a table of multiple expense line items
- A collage/collection of multiple payment screenshots or receipts

Extract EVERY individual expense/transaction you can find. For each one, extract:
- vendor: The business, store, company, or payee name
- date: The date of the transaction in YYYY-MM-DD format
- amount: The amount paid as a number (no currency symbols). Use the original numeric value regardless of currency.
- description: A brief description of what the expense is for (e.g. "Cab airport to venue", "LinkedIn subscription")

Return ONLY a valid JSON array of objects in this exact format:
[{"vendor": "...", "date": "YYYY-MM-DD", "amount": 123.45, "description": "..."}]

Rules:
- If the document contains multiple line items or multiple receipts, return one object per item/receipt.
- If only one transaction is found, still return it in an array.
- If a field cannot be determined, use null for that field.
- For payment app screenshots (UPI, BHIM, GPay, etc.), extract the payee name as vendor.
- Do not include any explanation, markdown, or extra text — just the JSON array.`;

/**
 * Extract expense data from a file URL or local file path using OpenAI Vision.
 * Returns an array of extracted expenses (may contain multiple items from one document).
 */
export async function extractExpenseData(
  fileUrlOrPath: string
): Promise<ExtractedExpense[]> {
  const contentParts = await buildContentParts(fileUrlOrPath);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all expense data from this document:",
          },
          ...contentParts,
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content?.trim() || "[]";
  const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(jsonStr);
    const items = Array.isArray(parsed) ? parsed : [parsed];

    return items.map(
      (item: {
        vendor?: string;
        date?: string;
        amount?: number;
        description?: string;
      }) => ({
        vendor: item.vendor || null,
        date: item.date || null,
        amount:
          item.amount !== undefined && item.amount !== null
            ? Number(item.amount)
            : null,
        description: item.description || null,
      })
    );
  } catch {
    console.error("Failed to parse OCR response:", text);
    return [{ vendor: null, date: null, amount: null, description: null }];
  }
}
