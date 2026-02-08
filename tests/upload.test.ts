import { describe, it, expect, afterAll } from "vitest";
import { uploadFile } from "@/lib/supabase";
import fs from "fs";
import path from "path";

describe("File Upload (local storage fallback)", () => {
  const uploadedFiles: string[] = [];

  afterAll(() => {
    // Clean up uploaded test files
    for (const filePath of uploadedFiles) {
      const abs = path.join(process.cwd(), "public", filePath);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
  });

  it("uploads a PDF file and returns a local URL", async () => {
    const samplePdf = path.join(process.cwd(), "samples", "bills", "bill1.pdf");
    const buffer = fs.readFileSync(samplePdf);

    const url = await uploadFile(buffer, "test-bill.pdf", "application/pdf");

    expect(url).toMatch(/^\/uploads\/.+test-bill\.pdf$/);
    uploadedFiles.push(url);

    // Verify the file actually exists on disk
    const absPath = path.join(process.cwd(), "public", url);
    expect(fs.existsSync(absPath)).toBe(true);
  });

  it("uploads an image file and returns a local URL", async () => {
    // Create a minimal PNG (1x1 pixel) for testing
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, // RGB, etc
      0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
      0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
      0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, // IEND chunk
      0xae, 0x42, 0x60, 0x82,
    ]);

    const url = await uploadFile(pngHeader, "test-image.png", "image/png");

    expect(url).toMatch(/^\/uploads\/.+test-image\.png$/);
    uploadedFiles.push(url);

    const absPath = path.join(process.cwd(), "public", url);
    expect(fs.existsSync(absPath)).toBe(true);
  });

  it("creates the uploads directory if it does not exist", async () => {
    const buffer = Buffer.from("test content");
    const url = await uploadFile(buffer, "test-file.txt", "text/plain");

    expect(url).toMatch(/^\/uploads\//);
    uploadedFiles.push(url);
  });
});
