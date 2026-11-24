import "server-only";

const UA_PRODUCT = "LicitatieRO-POC/0.1";
const UA_PROJECT = "https://github.com/LicitatieRO/marketplace";

export function repesContactFromEnv(): string | undefined {
  const value = process.env.REPES_CONTACT?.trim();
  return value || undefined;
}

export function isRepesProductionRuntime(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function assertRepesContactConfigured(options?: {
  useFixture?: boolean;
}): void {
  if (!isRepesProductionRuntime()) return;
  if (options?.useFixture || process.env.REPES_USE_FIXTURE === "true") return;
  if (!repesContactFromEnv()) {
    throw new Error(
      "REPES_CONTACT must be set in production before REPES ingest or HTTP fetch.",
    );
  }
}

export function buildRepesHttpUserAgent(): string {
  const contact = repesContactFromEnv() ?? "local-dev";
  return `${UA_PRODUCT} (+${UA_PROJECT}; contact: ${contact})`;
}