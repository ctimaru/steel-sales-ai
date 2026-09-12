"use server";

import { createClient } from "@/lib/supabase/server";

export type UploadState = {
  status: "idle" | "success" | "error";
  message: string;
  jobId?: string;
};

export async function uploadCommercialDocument(
  _previousState: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Seleziona un file da caricare." };
  }

  const allowedExtensions = new Set(["zip", "eml", "pdf", "xls", "xlsx"]);
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!extension || !allowedExtensions.has(extension)) {
    return { status: "error", message: "Formato non supportato. Usa ZIP, EML, PDF o Excel." };
  }

  if (file.size > 25 * 1024 * 1024) {
    return { status: "error", message: "Il file supera il limite di 25 MB." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const ownerId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!ownerId) {
    return { status: "error", message: "Sessione scaduta. Accedi di nuovo." };
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) {
    return { status: "error", message: "Worker non configurato nell'ambiente web." };
  }

  const upload = new FormData();
  upload.append("upload", file, file.name);
  // The owner UUID is derived from a verified Supabase session on the server.
  // Send it inside the server-to-server multipart body so proxies cannot drop
  // the authorization context carried in a custom header.
  upload.append("owner_id", ownerId);

  const headers: HeadersInit = {
    // Retain the header as a backwards-compatible fallback for older workers.
    "x-owner-id": ownerId,
  };
  if (process.env.WORKER_INTERNAL_TOKEN) {
    headers["x-worker-token"] = process.env.WORKER_INTERNAL_TOKEN;
  }

  try {
    const response = await fetch(`${workerUrl}/v1/uploads`, {
      method: "POST",
      headers,
      body: upload,
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | { job_id?: string; detail?: string }
      | null;

    if (!response.ok || !payload?.job_id) {
      return {
        status: "error",
        message: payload?.detail ?? "Il worker ha rifiutato il caricamento.",
      };
    }

    return {
      status: "success",
      message: "Upload accettato. Il worker sta elaborando e pubblicando i dati commerciali.",
      jobId: payload.job_id,
    };
  } catch {
    return { status: "error", message: "Worker non raggiungibile." };
  }
}
