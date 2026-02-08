import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

let _supabaseAdmin: SupabaseClient | null = null;

const BUCKET = "receipts";

function isSupabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder")
  );
}

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabaseAdmin;
}

async function uploadToSupabase(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const filePath = `uploads/${Date.now()}-${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { contentType, upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  return publicUrl;
}

function uploadToLocal(
  file: Buffer,
  fileName: string
): string {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const uniqueName = `${Date.now()}-${fileName}`;
  const filePath = path.join(uploadsDir, uniqueName);
  fs.writeFileSync(filePath, file);

  return `/uploads/${uniqueName}`;
}

/**
 * Create a signed URL for a file in Supabase Storage.
 * Works even when the bucket is private.
 */
export async function getSignedUrl(publicUrl: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const prefix = `/storage/v1/object/public/${BUCKET}/`;
  const url = new URL(publicUrl);
  const filePath = url.pathname.slice(url.pathname.indexOf(prefix) + prefix.length);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 300); // 5 minutes

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }

  return data.signedUrl;
}

/**
 * Check if a URL points to our Supabase Storage.
 */
export function isSupabaseUrl(url: string): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    url.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

export async function uploadFile(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  if (isSupabaseConfigured()) {
    return uploadToSupabase(file, fileName, contentType);
  }

  // Vercel has a read-only filesystem — local uploads won't work in production
  if (process.env.VERCEL) {
    throw new Error(
      "Supabase Storage must be configured for production deployments. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return uploadToLocal(file, fileName);
}
