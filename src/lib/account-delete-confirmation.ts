export function isAccountDeleteConfirmationValid(
  confirmation: string,
  userEmail: string,
): boolean {
  const trimmed = confirmation.trim();
  if (!trimmed) return false;
  if (trimmed === "ȘTERGE" || trimmed === "DELETE") return true;
  return trimmed.toLowerCase() === userEmail.trim().toLowerCase();
}
