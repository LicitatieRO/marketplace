import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FounderOutbox } from "@/components/founder-outbox";

describe("FounderOutbox recipient row", () => {
  it("renders signup_confirm masked recipient in the To line", () => {
    const html = renderToStaticMarkup(
      FounderOutbox({
        previews: [
          {
            id: 1,
            subject: "LicitatieRO — confirmă contul / confirm your account",
            maskedBody: "https://example.test/verify",
            createdAt: "2026-11-14T12:00:00.000Z",
            recipientEmail: "n***@example.test",
            hasActionLink: false,
          },
        ],
        revealEnabled: false,
      }),
    );
    expect(html).toContain("Către / To: n***@example.test");
    expect(html).not.toContain("Către / To: </p>");
  });
});