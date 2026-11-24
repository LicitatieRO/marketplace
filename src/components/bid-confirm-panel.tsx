"use client";

import type { Ref } from "react";
import { bidConfirmPrompt, bidGlossary } from "@/lib/bid-copy";
import { money } from "@/lib/format";
import type { Language } from "@/lib/types";

type BidConfirmPanelProps = {
  language: Language;
  amountMinor: number;
  minIncrementMinor: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
  confirmButtonRef?: Ref<HTMLButtonElement>;
};

export function BidConfirmPanel({
  language,
  amountMinor,
  minIncrementMinor,
  busy,
  onConfirm,
  onCancel,
  testId = "bid-confirm-panel",
  confirmButtonRef,
}: BidConfirmPanelProps) {
  const glossary = bidGlossary(language);
  const confirmTestId = testId.replace(/-panel$/, "") || "bid-confirm";
  return (
    <div className="lr-map-confirm panel-inset" data-testid={testId}>
      <p data-testid={`${testId}-prompt`}>
        {bidConfirmPrompt(
          language,
          money(amountMinor, language),
          money(minIncrementMinor, language),
        )}
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          ref={confirmButtonRef}
          type="button"
          className="button primary"
          data-testid={confirmTestId}
          disabled={busy}
          onClick={onConfirm}
        >
          {glossary.confirmBid}
        </button>
        <button
          type="button"
          className="button"
          data-testid={`${confirmTestId}-cancel`}
          onClick={onCancel}
        >
          {glossary.cancel}
        </button>
      </div>
    </div>
  );
}