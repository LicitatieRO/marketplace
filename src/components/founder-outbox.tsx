import Link from "next/link";
import type { FounderOutboxClientPreview } from "@/lib/founder-outbox-preview";
import { maskActionLinksInText } from "@/lib/notification-preview-mask";
import { FounderOutboxPreviewRow } from "@/components/founder-outbox-preview-row";

export function FounderOutbox({
  previews,
  revealEnabled,
}: {
  previews: FounderOutboxClientPreview[];
  revealEnabled: boolean;
}) {
  return (
    <main id="main" className="founder-shell">
      <div className="founder-inner">
        <Link href="/founder" className="back-link">
          ← Plan & calculator
        </Link>
        <section className="founder-intro" style={{ display: "block", paddingTop: 28 }}>
          <p className="eyebrow">POC / Simulare</p>
          <h1>
            Outbox <span>previzualizare</span>
          </h1>
          <p className="intro-copy">
            E-mailuri neexpediate în staging (fără domeniu Resend). Conținutul este doar pentru verificare internă; nu reprezintă trimitere reală.
          </p>
          <p className="intro-copy" lang="en">
            Undelivered notification previews for staging. No live SMTP; not billing or production delivery.
          </p>
        </section>
        <section className="panel" style={{ marginBottom: 48 }}>
          <h2>Previzualizări recente / Recent previews</h2>
          {previews.length === 0 ? (
            <p>Încă nu există previzualizări. / No previews yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 20 }}>
              {previews.map((row) => (
                <FounderOutboxPreviewRow
                  key={row.id}
                  id={row.id}
                  subject={row.subject}
                  createdAt={row.createdAt}
                  recipientEmail={row.recipientEmail}
                  maskedBody={row.maskedBody}
                  hasActionLink={row.hasActionLink}
                  revealEnabled={revealEnabled}
                />
              ))}
            </ul>
          )}
          {previews.length > 0 ? (
            <p className="small muted" style={{ marginTop: 16 }}>
              Linkurile de confirmare apar mascate ({maskActionLinksInText("https://host.example/auth/v1/verify?token=hidden")}). /
              Confirmation links are masked by default.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}