"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getCloudConfiguration } from "./config";

type BrowserCloudClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserCloudClient | null | undefined;

export function getBrowserCloudClient(): BrowserCloudClient | null {
  if (browserClient !== undefined) return browserClient;
  const configuration = getCloudConfiguration();
  browserClient = configuration
    ? createBrowserClient(configuration.url, configuration.publishableKey)
    : null;
  return browserClient;
}
