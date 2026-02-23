"use client";

import { useEffect } from "react";

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
    redirectParams.set("error", params.get("error_code") ?? error);

    const description = params.get("error_description");
    if (description) {
      redirectParams.set("message", description);
    }

    window.location.replace(`/verify-email?${redirectParams.toString()}`);
  }, []);

  return null;
};
