import type { Viewer } from "@/lib/types";

const DEMO_PERSONA_KEY = "licitatiero-demo-persona";

export function hasOwnerTourSession(viewer: Viewer | null): boolean {
  if (typeof window === "undefined") return Boolean(viewer);
  const persona = sessionStorage.getItem(DEMO_PERSONA_KEY);
  if (persona === "owner" || persona === "dual") return true;
  return Boolean(viewer);
}