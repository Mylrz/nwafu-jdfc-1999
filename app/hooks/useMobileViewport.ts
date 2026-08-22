"use client";

import { useSyncExternalStore } from "react";

const mobileQuery = "(max-width: 740px), (max-width: 900px) and (max-height: 520px)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  return typeof window !== "undefined" && window.matchMedia(mobileQuery).matches;
}

function getServerSnapshot() {
  return false;
}

export function useMobileViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
