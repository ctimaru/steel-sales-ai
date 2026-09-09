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

  if (!data?.claims) {
    return { status: "error", message: "Sessione scaduta. Accedi di nuovo." };
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) {
    return { status: "error", message: "Worker non configurato nell'ambiente web." };
  }

  const upload = new FormData();
  upload.append("upload", file, file.name);

  const headers: HeadersInit = {};
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
      message: "Upload accettato. Il worker sta elaborando il documento.",
      jobId: payload.job_id,
    };
  } catch {
    return { status: "error", message: "Worker non raggiungibile." };
  }
}
