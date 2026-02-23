const EMAIL_LINK_ERROR_CODES = new Set(["otp_expired"]);

const normalize = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase();

/**
 * Returns true when an auth error indicates an expired/invalid email confirmation link.
 */
export const isEmailConfirmationLinkError = (
  errorCode: string | null | undefined,
  errorDescription: string | null | undefined
): boolean => {
  const code = normalize(errorCode);
  const description = normalize(errorDescription);

  if (EMAIL_LINK_ERROR_CODES.has(code)) {
    return true;
  }

  if (!description) {
    return false;
  }

  const mentionsEmailLink = description.includes("email link");
  const mentionsInvalidOrExpired = description.includes("invalid") || description.includes("expired");

  return mentionsEmailLink && mentionsInvalidOrExpired;
};
