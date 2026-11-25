/** Password rules, the same as the server's (see NewPassword in backend/app/schemas.py). */
export const PASSWORD_HINT = "At least 8 characters, with a letter and a number.";

/** What is wrong with a new password, or null when it is fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use at least one letter and one number.";
  if (new TextEncoder().encode(password).length > 72) return "That's too long. Use at most 72 characters.";
  return null;
}
