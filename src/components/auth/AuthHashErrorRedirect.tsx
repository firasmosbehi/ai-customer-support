"use client";

import { useEffect } from "react";
import { isEmailConfirmationLinkError } from "@/lib/authErrors";

/**
 * Handles auth errors returned in URL hash fragments (not visible to server components).
 */
export const AuthHashErrorRedirect = () => {
  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";

    if (!hash) {
      return;
    }

    const params = new URLSearchParams(hash);
    const error = params.get("error");

    if (!error) {
      return;
    }

    const redirectParams = new URLSearchParams();
    const effectiveErrorCode = params.get("error_code") ?? error;
    redirectParams.set("error", effectiveErrorCode);

    const description = params.get("error_description");
    if (description) {
      redirectParams.set("message", description);
    }

    const isEmailError = isEmailConfirmationLinkError(effectiveErrorCode, description);
    const targetPath = isEmailError ? "/verify-email" : "/login";

    window.location.replace(`${targetPath}?${redirectParams.toString()}`);
  }, []);

  return null;
};
