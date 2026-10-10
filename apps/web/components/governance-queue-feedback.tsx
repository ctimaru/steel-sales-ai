/** Accessible, server-rendered feedback for governance queues. */
export function GovernanceQueueFeedback({ message, error }: { message?: string | null; error?: string | null }) {
  return (
    <>
      {error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          <strong className="mr-2">Operazione non completata.</strong>{error}
        </div>
      ) : null}
      {message ? (
        <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <strong className="mr-2">Operazione completata.</strong>{message}
        </div>
      ) : null}
    </>
  );
}
