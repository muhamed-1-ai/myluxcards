"use client";

import React from "react";
import MoreView from "./MoreView";

/**
 * Backward compatibility wrapper:
 * Accounting Settings has been migrated to Accounting -> More (Configuration Group).
 * Any direct invocation of SettingsView renders the reorganized configuration tools inside MoreView.
 */
export default function SettingsView() {
  return <MoreView initialGroup="CONFIGURATION" />;
}
