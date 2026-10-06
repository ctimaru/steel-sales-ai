import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const ALLOWED_ORIGINS = new Set([
  "https://smartsteelsales.com",
  "https://www.smartsteelsales.com",
  "http://localhost:3000",
]);
const BUCKET = "rfq-supplier-offers";
const MAX_SIZE = 10 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : null;
  return {
    "Access-Control-Allow-Origin": allowed ?? "https://www.smartsteelsales.com",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeMime(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const inferred = MIME_BY_EXTENSION[extension];
  if (!inferred) return null;
  if (file.type && file.type !== inferred && !(extension === "xls" && file.type === "application/octet-stream")) {
    return null;
  }
  return inferred;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json(origin, 403, { error: "origin_not_allowed" });
    }
    return new Response("ok", { headers: cors(origin) });
  }

  if (req.method !== "POST") {
    return json(origin, 405, { error: "method_not_allowed" });
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(origin, 403, { error: "origin_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  let secretKey = "";
  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    secretKey = secretKeys.default ?? "";
  } catch {
    secretKey = "";
  }
  secretKey ||= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !secretKey) {
    return json(origin, 500, { error: "server_configuration_missing" });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(origin, 400, { error: "invalid_form_data" });
  }

  const token = String(form.get("token") ?? "").trim();
  const fileValue = form.get("file");

  if (!token || token.length < 20) {
    return json(origin, 400, { error: "valid_rfq_token_required" });
  }
  if (!(fileValue instanceof File)) {
    return json(origin, 400, { error: "offer_file_required" });
  }
  if (fileValue.size < 1 || fileValue.size > MAX_SIZE) {
    return json(origin, 413, { error: "file_size_limit_10mb" });
  }

  const mimeType = safeMime(fileValue);
  if (!mimeType) {
    return json(origin, 415, { error: "pdf_xls_xlsx_only" });
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tokenHash = await sha256Hex(token);
  const { data: prepared, error: prepareError } = await admin.rpc(
    "rfqh4_prepare_attachment",
    {
      p_token_hash: tokenHash,
      p_file_name: fileValue.name,
      p_mime_type: mimeType,
      p_size_bytes: fileValue.size,
    },
  );

  if (prepareError || !prepared || typeof prepared !== "object" || Array.isArray(prepared)) {
    return json(origin, 409, {
      error: "attachment_not_allowed",
      detail: prepareError?.message ?? "Unable to prepare attachment",
    });
  }

  const permit = prepared as {
    quote_id?: string;
    revision_no?: number;
    old_attachment_path?: string | null;
  };

  if (!permit.quote_id || !permit.revision_no) {
    return json(origin, 500, { error: "invalid_attachment_permit" });
  }

  const extension = Object.entries(MIME_BY_EXTENSION).find(([, mime]) => mime === mimeType)?.[0] ?? "bin";
  const path =
    permit.quote_id +
    "/v" +
    String(permit.revision_no) +
    "/" +
    crypto.randomUUID() +
    "." +
    extension;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, fileValue, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return json(origin, 502, {
      error: "storage_upload_failed",
      detail: uploadError.message,
    });
  }

  const { data: recorded, error: recordError } = await admin.rpc(
    "rfqh4_record_attachment",
    {
      p_token_hash: tokenHash,
      p_storage_path: path,
      p_file_name: fileValue.name,
      p_mime_type: mimeType,
      p_size_bytes: fileValue.size,
    },
  );

  if (recordError) {
    await admin.storage.from(BUCKET).remove([path]);
    return json(origin, 409, {
      error: "attachment_record_failed",
      detail: recordError.message,
    });
  }

  if (permit.old_attachment_path && permit.old_attachment_path !== path) {
    await admin.storage.from(BUCKET).remove([permit.old_attachment_path]);
  }

  const result =
    recorded && typeof recorded === "object" && !Array.isArray(recorded)
      ? (recorded as Record<string, unknown>)
      : {};

  return json(origin, 200, {
    ok: true,
    quote_id: permit.quote_id,
    revision_no: permit.revision_no,
    attachment_name: result.attachment_name ?? fileValue.name,
    size_bytes: fileValue.size,
  });
});
