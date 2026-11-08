"use client";

import { useEffect } from "react";

/** Removes the cached identity and profile kept for instant rendering. */
export function clearClientSession() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith("healthos_"))
    .forEach((key) => localStorage.removeItem(key));
}

function requestPath(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.pathname : input.url;
}

/**
 * Sends the user back to login whenever an API call reports that the session
 * has expired, so no individual page has to handle it.
 */
export default function SessionWatcher() {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      const path = requestPath(args[0]);
      const isAppApi = path.includes("/api/") && !path.includes("/api/auth/");

      if (response.status === 401 && isAppApi && window.location.pathname !== "/login") {
        clearClientSession();
        window.location.assign("/login");
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
