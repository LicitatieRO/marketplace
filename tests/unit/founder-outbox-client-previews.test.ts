import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FounderOutbox } from "@/components/founder-outbox";
import {
  mapPreviewsForClient,
  type FounderOutboxPreviewSource,
} from "@/lib/founder-outbox-preview";

const SECRET_TOKEN = "super-secret-preview-token";

function sampleRow(
  overrides: Partial<FounderOutboxPreviewSource> = {},
): FounderOutboxPreviewSource {
  return {
    id: 1,
    subject: "Confirm",
    body: [
      "Click:",
      `https://supabase.example.test/auth/v1/verify?token=${SECRET_TOKEN}`,
    ].join("\n"),
    created_at: "2026-11-14T12:00:00.000Z",
    recipient_email: "n***@example.test",
    ...overrides,
  };
}

describe("mapPreviewsForClient", () => {
  it("omits raw verify tokens from client preview fields", () => {
    const mapped = mapPreviewsForClient([sampleRow()]);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].maskedBody).toContain("/auth/v1/verify");
    expect(mapped[0].maskedBody).not.toContain(SECRET_TOKEN);
    expect(mapped[0].hasActionLink).toBe(true);
    expect(JSON.stringify(mapped[0])).not.toContain(SECRET_TOKEN);
  });

  it("masks percent-encoded verify links and token_hash in client rows", () => {
    const encodedBody = [
      "Encoded:",
      "https%3A%2F%2Fsupabase.example.test%2Fauth%2Fv1%2Fverify%3Ftoken_hash%3Dleak-me",
    ].join("\n");
    const mapped = mapPreviewsForClient([
      sampleRow({ body: encodedBody }),
    ]);
    expect(mapped[0].maskedBody).toContain("/auth/v1/verify");
    expect(mapped[0].maskedBody).not.toContain("leak-me");
    expect(mapped[0].maskedBody).not.toContain("token_hash");
    expect(JSON.stringify(mapped[0])).not.toContain("leak-me");
  });

  it("does not leak tokens through FounderOutbox props passed to client rows", () => {
    const mapped = mapPreviewsForClient([sampleRow()]);
    const html = renderToStaticMarkup(
      FounderOutbox({ previews: mapped, revealEnabled: true }),
    );
    expect(html).toContain("/auth/v1/verify");
    expect(html).not.toContain(SECRET_TOKEN);
    expect(html).not.toContain(`token=${SECRET_TOKEN}`);
  });
});
