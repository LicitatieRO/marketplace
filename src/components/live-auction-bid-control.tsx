"use client";

import type { Ref } from "react";
import { BidConfirmPanel } from "@/components/bid-confirm-panel";
import { bidGlossary } from "@/lib/bid-copy";
import { money } from "@/lib/format";
import type { Language } from "@/lib/types";

const INCREMENT_STEPS = [1, 2, 5] as const;

export type LiveAuctionBidControlProps = {
  language: Language;
  variant: "map" | "detail";
  inputId: string;
  amountMinor: number | null;
  onAmountMinorChange: (minor: number) => void;
  confirmAmountMinor: number | null;
  onOpenConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirmSubmit: () => void;
  minimumBidMinor: number;
  minIncrementMinor: number;
  busy: boolean;
  currentBidMinor: number;
  outbid?: boolean;
  leadingBid?: boolean;
  confirmButtonRef?: Ref<HTMLButtonElement>;
  testIdPrefix: "map" | "listing";
  amountLabel?: string;
  stepMajor?: number;
};

export function LiveAuctionBidControl({
  language,
  variant,
  inputId,
  amountMinor,
  onAmountMinorChange,
  confirmAmountMinor,
  onOpenConfirm,
  onCancelConfirm,
  onConfirmSubmit,
  minimumBidMinor,
  minIncrementMinor,
  busy,
  currentBidMinor,
  outbid = false,
  leadingBid = false,
  confirmButtonRef,
  testIdPrefix,
  amountLabel,
  stepMajor,
}: LiveAuctionBidControlProps) {
  const glossary = bidGlossary(language);
  const label = amountLabel ?? glossary.bidAmountLabel;
  const step = stepMajor ?? minIncrementMinor / 100;
  const minMajor = minimumBidMinor / 100;
  const confirming = confirmAmountMinor !== null;

  const addIncrement = (multiplier: number) => {
    if (confirming) onCancelConfirm();
    const base =
      amountMinor !== null && amountMinor >= minimumBidMinor
        ? amountMinor
        : minimumBidMinor;
    onAmountMinorChange(base + minIncrementMinor * multiplier);
  };

  const amountInput = (
    <input
      id={inputId}
      data-testid={`${testIdPrefix}-bid-amount`}
      type="number"
      min={minMajor}
      step={step}
      value={amountMinor !== null ? amountMinor / 100 : ""}
      disabled={confirming || busy}
      required={variant === "detail"}
      onChange={(event) => {
        if (confirming) onCancelConfirm();
        const minor = Math.round(Number(event.target.value) * 100);
        if (Number.isFinite(minor)) onAmountMinorChange(minor);
      }}
    />
  );

  return (
    <div
      className={
        variant === "map" ? "lr-map-bid-control" : "stack-form listing-bid-control"
      }
      data-testid={`${testIdPrefix}-bid-control`}
    >
      {outbid ? (
        <p
          className="feedback warn"
          aria-live="polite"
          data-testid={`${testIdPrefix}-outbid-banner`}
        >
          {language === "ro"
            ? `Ai fost depășit. Oferta curentă: ${money(currentBidMinor, language)}`
            : `You've been outbid. Current bid: ${money(currentBidMinor, language)}`}
        </p>
      ) : null}
      {leadingBid ? (
        <p
          className="feedback success"
          aria-live="polite"
          data-testid={`${testIdPrefix}-leading-banner`}
        >
          {language === "ro"
            ? "Ești pe primul loc (simulare)"
            : "You're the highest bidder (simulation)"}
        </p>
      ) : null}
      <label className={variant === "map" ? "small" : undefined} htmlFor={inputId}>
        {label}
        {variant === "detail" ? (
          <div className="currency-input">
            {amountInput}
            <span>EUR</span>
          </div>
        ) : (
          amountInput
        )}
      </label>
      <div
        role="group"
        aria-label={glossary.incrementChipsAria}
        data-testid={`${testIdPrefix}-bid-increment-chips`}
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
      >
        <span className="chip poc" data-testid={`${testIdPrefix}-bid-poc-chip`}>
          {glossary.pocSimulare}
        </span>
        {INCREMENT_STEPS.map((mult) => (
          <button
            key={mult}
            type="button"
            className="chip"
            disabled={confirming || busy || minIncrementMinor <= 0}
            data-testid={`${testIdPrefix}-bid-inc-${mult}`}
            onClick={() => addIncrement(mult)}
          >
            +
            {money(minIncrementMinor * mult, language)}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="button primary"
        data-testid={`${testIdPrefix}-place-bid`}
        disabled={
          confirming ||
          busy ||
          amountMinor === null ||
          amountMinor < minimumBidMinor
        }
        onClick={onOpenConfirm}
      >
        {glossary.placeBid}
      </button>
      {confirmAmountMinor !== null ? (
        <BidConfirmPanel
          language={language}
          amountMinor={confirmAmountMinor}
          minIncrementMinor={minIncrementMinor}
          busy={busy}
          testId={`${testIdPrefix}-bid-confirm-panel`}
          confirmButtonRef={confirmButtonRef}
          onCancel={onCancelConfirm}
          onConfirm={onConfirmSubmit}
        />
      ) : null}
    </div>
  );
}