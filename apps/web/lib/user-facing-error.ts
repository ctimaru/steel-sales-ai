export type UserFacingIssueCode =
  | "session_expired"
  | "email_not_confirmed"
  | "permission_denied"
  | "rate_limited"
  | "not_found"
  | "conflict"
  | "validation"
  | "temporary_unavailable"
  | "operation_failed";

export type UserFacingIssue = {
  code: UserFacingIssueCode;
  message: string;
  retryable: boolean;
};

type ErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  status?: number | string | null;
  statusCode?: number | string | null;
};

function errorLike(input: unknown): ErrorLike {
  if (!input || typeof input !== "object") return {};
  return input as ErrorLike;
}

function numericStatus(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toUserFacingIssue(
  input: unknown,
  fallback = "Operazione non completata. Riprova tra poco.",
): UserFacingIssue {
  const error = errorLike(input);
  const code = String(error.code ?? "").toLowerCase();
  const message = String(error.message ?? "").toLowerCase();
  const details = String(error.details ?? "").toLowerCase();
  const combined = [message, details].filter(Boolean).join(" ");
  const status = numericStatus(error.status ?? error.statusCode);

  if (
    [
      "refresh_token_not_found",
      "session_not_found",
      "bad_jwt",
      "jwt_expired",
      "invalid_token",
    ].includes(code) ||
    combined.includes("jwt expired") ||
    combined.includes("refresh token") ||
    combined.includes("session missing") ||
    combined.includes("session not found")
  ) {
    return {
      code: "session_expired",
      message: "La sessione è scaduta. Accedi di nuovo e ripeti l’operazione.",
      retryable: false,
    };
  }

  if (code === "email_not_confirmed") {
    return {
      code: "email_not_confirmed",
      message: "Conferma prima il tuo indirizzo email per continuare.",
      retryable: false,
    };
  }

  if (
    status === 429 ||
    code.includes("rate_limit") ||
    combined.includes("too many requests") ||
    combined.includes("rate limit")
  ) {
    return {
      code: "rate_limited",
      message: "Troppi tentativi ravvicinati. Attendi qualche minuto e riprova.",
      retryable: true,
    };
  }

  if (
    code === "42501" ||
    status === 401 ||
    status === 403 ||
    combined.includes("permission denied") ||
    combined.includes("not allowed") ||
    combined.includes("admin role required") ||
    combined.includes("membership required") ||
    combined.includes("authentication required")
  ) {
    return {
      code: "permission_denied",
      message:
        "Non hai i permessi necessari per questa operazione. Se l’accesso dovrebbe essere disponibile, chiedi a un amministratore aziendale.",
      retryable: false,
    };
  }

  if (
    code === "p0002" ||
    code === "pgrst116" ||
    status === 404 ||
    combined.includes("not found")
  ) {
    return {
      code: "not_found",
      message: "L’elemento richiesto non è più disponibile. Aggiorna la pagina e riprova.",
      retryable: false,
    };
  }

  if (
    code === "23505" ||
    status === 409 ||
    combined.includes("duplicate") ||
    combined.includes("already exists") ||
    combined.includes("already has") ||
    combined.includes("immutable")
  ) {
    return {
      code: "conflict",
      message:
        "Lo stato è cambiato oppure l’operazione risulta già completata. Aggiorna la pagina prima di riprovare.",
      retryable: true,
    };
  }

  if (
    code === "22023" ||
    code === "23514" ||
    status === 400 ||
    status === 422
  ) {
    return {
      code: "validation",
      message: fallback,
      retryable: false,
    };
  }

  if (
    status >= 500 ||
    code === "fetch_error" ||
    combined.includes("network") ||
    combined.includes("timeout") ||
    combined.includes("temporarily unavailable") ||
    combined.includes("failed to fetch")
  ) {
    return {
      code: "temporary_unavailable",
      message: "Servizio temporaneamente non disponibile. Riprova tra poco.",
      retryable: true,
    };
  }

  return {
    code: "operation_failed",
    message: fallback,
    retryable: true,
  };
}

export function safeErrorMessage(input: unknown, fallback?: string) {
  return toUserFacingIssue(input, fallback).message;
}

export function feedbackPath(
  path: string,
  input: unknown,
  fallback?: string,
) {
  const issue = toUserFacingIssue(input, fallback);
  const separator = path.includes("?") ? "&" : "?";
  return (
    path +
    separator +
    "error=" +
    encodeURIComponent(issue.message) +
    "&error_code=" +
    encodeURIComponent(issue.code) +
    (issue.retryable ? "&retry=1" : "")
  );
}

export function sessionRecoveryPath() {
  return (
    "/login?error=" +
    encodeURIComponent(
      "La sessione è scaduta. Accedi di nuovo per continuare dal tuo workspace.",
    ) +
    "&error_code=session_expired"
  );
}
