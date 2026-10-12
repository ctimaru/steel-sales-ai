/** BD14: fail closed if a confirmed supplier set differs from the live server-side set. */
export function matchesConfirmedRecipients(expected: string[], actual: string[]): boolean {
  if (!Array.isArray(expected) || !Array.isArray(actual) || expected.length < 1 ||
      expected.length !== actual.length || expected.length > 100) return false;
  const a = [...expected].sort();
  const b = [...actual].sort();
  return a.every((id, index) => typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) &&
    id === b[index] && (index === 0 || id !== a[index - 1]));
}
