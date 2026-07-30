"use client";

import { useEffect } from "react";

export default function RecoveryRedirect() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const isRecovery = hash.get("type") === "recovery" || query.get("type") === "recovery";
    if (!isRecovery) return;

    const destination = `/reset-password${window.location.search}${window.location.hash}`;
    window.location.replace(destination);
  }, []);

  return null;
}
