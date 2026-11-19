import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getViewer = vi.fn();
const headersGet = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => headersGet(name),
  }),
}));

vi.mock("@/lib/server/auth", () => ({
  getViewer: (...args: unknown[]) => getViewer(...args),
}));

vi.mock("@/lib/server/notifications-db", () => ({
  listNotificationPreviews: vi.fn(),
}));

const env = process.env;

describe("founder outbox generateMetadata", () => {
  beforeEach(() => {
    process.env = {
      ...env,
      APP_URL: "https://licitatiero-staging.vercel.app",
      VERCEL_ENV: "production",
    };
    headersGet.mockImplementation((name: string) =>
      name === "host" ? "licitatiero-staging.vercel.app" : null,
    );
  });

  afterEach(() => {
    vi.resetModules();
    getViewer.mockReset();
    headersGet.mockReset();
    process.env = { ...env };
    vi.unstubAllEnvs();
  });

  it("returns generic metadata when viewer is not staff AAL2", async () => {
    getViewer.mockResolvedValue({
      id: "u",
      email: "guest@test",
      display_name: "Guest",
      is_staff: false,
      aal: "aal1",
    });
    const { generateMetadata } = await import("@/app/founder/outbox/page");
    await expect(generateMetadata()).resolves.toEqual({ title: "Not found" });
  });

  it("returns generic metadata on non-staging host even for staff", async () => {
    process.env.APP_URL = "https://licitatiero-production.vercel.app";
    headersGet.mockImplementation((name: string) =>
      name === "host" ? "licitatiero-production.vercel.app" : null,
    );
    getViewer.mockResolvedValue({
      id: "u",
      email: "staff@test",
      display_name: "Staff",
      is_staff: true,
      aal: "aal2",
    });
    const { generateMetadata } = await import("@/app/founder/outbox/page");
    await expect(generateMetadata()).resolves.toEqual({ title: "Not found" });
  });

  it("returns outbox metadata when viewer is staff at AAL2", async () => {
    getViewer.mockResolvedValue({
      id: "u",
      email: "staff@test",
      display_name: "Staff",
      is_staff: true,
      aal: "aal2",
    });
    const { generateMetadata } = await import("@/app/founder/outbox/page");
    await expect(generateMetadata()).resolves.toEqual({
      title: "Staging notification outbox",
      description: "Staff-only staging preview of undelivered notification emails.",
    });
  });
});