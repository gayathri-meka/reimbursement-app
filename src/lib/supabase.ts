import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

let _supabaseAdmin: SupabaseClient | null = null;

const BUCKET = "expense-documents";

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

export async function uploadFile(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  if (isSupabaseConfigured()) {
    return uploadToSupabase(file, fileName, contentType);
  }
  return uploadToLocal(file, fileName);
}
