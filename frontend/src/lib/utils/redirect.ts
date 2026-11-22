/**
 * Validates a redirect URL path to prevent Open Redirect vulnerabilities.
 * Ensures the target is a relative local path within the application.
 */
export function getSafeRedirectUrl(
  target: string | null | undefined,
  fallback: string = "/dashboard"
): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();

  // Must begin with a single slash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }

  // Prevent protocol-relative or encoded scheme bypasses
  if (
    trimmed.includes(":") ||
    trimmed.includes("javascript:") ||
    trimmed.includes("data:") ||
    trimmed.includes("vbscript:")
  ) {
    return fallback;
  }

  return trimmed;
}
