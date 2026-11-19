"use client";

import { useState } from "react";

function formatWhen(value: string) {
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function FounderOutboxPreviewRow({
  id,
  subject,
  createdAt,
  recipientEmail,
  maskedBody,
  hasActionLink,
  revealEnabled,
}: {
  id: number;
  subject: string;
  createdAt: string;
  recipientEmail: string;
  maskedBody: string;
  hasActionLink: boolean;
  revealEnabled: boolean;
}) {
  const [displayBody, setDisplayBody] = useState(maskedBody);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canReveal = revealEnabled && !revealed && hasActionLink;

  const onReveal = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/founder/outbox/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewId: id }),
      });
      const payload = (await response.json()) as {
        data?: { body?: string };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Reveal failed");
      }
      setDisplayBody(payload.data?.body ?? displayBody);
      setRevealed(true);
    } catch (revealError) {
      setError(
        revealError instanceof Error ? revealError.message : "Reveal failed",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      style={{
        border: "1px solid #d8dcd5",
        borderRadius: 12,
        padding: 20,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <strong>{subject}</strong>
        <span style={{ color: "#5b6c70", fontSize: 13 }}>
          {formatWhen(createdAt)}
        </span>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#52656b" }}>
        Către / To: {recipientEmail}
      </p>
      {canReveal ? (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#52656b" }}>
          <button
            type="button"
            className="button"
            disabled={busy}
            data-testid={`outbox-reveal-${id}`}
            onClick={() => void onReveal()}
          >
            {busy ? "…" : "Reveal link / Afișează linkul"}
          </button>
          {error ? <span style={{ marginLeft: 8, color: "#a4654e" }}>{error}</span> : null}
        </p>
      ) : null}
      <pre
        style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          fontFamily: "inherit",
          fontSize: 13,
          color: "#233b43",
          background: "#f8f7f2",
          padding: 14,
          borderRadius: 8,
        }}
      >
        {displayBody}
      </pre>
    </li>
  );
}