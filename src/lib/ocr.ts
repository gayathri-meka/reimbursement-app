import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";

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
 * Convert a PDF file to PNG images (one per page) using pdftoppm.
 * Returns an array of temporary PNG file paths.
 */
function pdfToImages(pdfPath: string): string[] {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ocr-pdf-"));
  const outputPrefix = path.join(tmpDir, "page");

  execSync(`pdftoppm -png -r 200 "${pdfPath}" "${outputPrefix}"`, {
    timeout: 30000,
  });

  // pdftoppm outputs page-1.png, page-2.png, etc.
  return fs
    .readdirSync(tmpDir)
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => path.join(tmpDir, f));
}

/**
 * Build image content parts for the OpenAI Vision API.
 * For PDFs, converts to images first. Returns one or more content parts.
 */
function buildImageParts(
  fileUrlOrPath: string
): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  // Remote URL — send directly (works for image URLs)
  if (
    fileUrlOrPath.startsWith("http://") ||
    fileUrlOrPath.startsWith("https://")
  ) {
    return [
      {
        type: "image_url",
        image_url: { url: fileUrlOrPath, detail: "high" },
      },
    ];
  }

  const absolutePath = path.resolve(fileUrlOrPath);
  const ext = path.extname(absolutePath).toLowerCase();

  // PDF — convert to images first
  if (ext === ".pdf") {
    const imagePaths = pdfToImages(absolutePath);
    return imagePaths.map((imgPath) => {
      const base64 = fs.readFileSync(imgPath).toString("base64");
      return {
        type: "image_url" as const,
        image_url: {
          url: `data:image/png;base64,${base64}`,
          detail: "high" as const,
        },
      };
    });
  }

  // Regular image file
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
  const imageParts = buildImageParts(fileUrlOrPath);

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
          ...imageParts,
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
