'use client';

import { useState } from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { usePlatform } from '@/components/platform';
import {
  isPromoCheckoutErrorCode,
  promoCheckoutUserMessage,
  promoPanelSimulationOnly,
  type PromoCheckoutMode,
} from '@/lib/payments/promo-client';

type PromoRow = Record<string, unknown>;

function promoIsActive(row: PromoRow) {
  return String(row.status) === 'active';
}

function promoIsPending(row: PromoRow) {
  return String(row.status) === 'pending';
}

export function PropertyPromoPanel({
  propertyId,
  promos,
  onComplete,
  checkoutMode,
  showEnvironmentNote = false,
}: {
  propertyId: string;
  promos: PromoRow[];
  onComplete: () => Promise<void>;
  checkoutMode: PromoCheckoutMode;
  showEnvironmentNote?: boolean;
}) {
  const { t } = usePlatform();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const scoped = promos.filter((row) => String(row.property_id) === propertyId);
  const active = scoped.find(promoIsActive);
  const pending = scoped.find(promoIsPending);
  const simulationOnly = promoPanelSimulationOnly(checkoutMode);
  const canStartCheckout = !simulationOnly && !active && !pending;

  async function startCheckout() {
    if (!canStartCheckout || !accepted || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/payments/promo/checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          idempotency_key: crypto.randomUUID(),
          accept_terms: true,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        const code = typeof body.error === 'string' ? body.error : undefined;
        setFeedback(
          isPromoCheckoutErrorCode(code)
            ? promoCheckoutUserMessage(code, t)
            : promoCheckoutUserMessage(undefined, t),
        );
        return;
      }
      if (body.data?.checkout_url) {
        window.location.href = body.data.checkout_url;
        return;
      }
      setFeedback(
        t(
          'Simulare reușită (POC / Simulare). Sumă reală: 0,00 EUR.',
          'Simulation completed (POC / Simulation). Real amount: €0.00.',
        ),
      );
      await onComplete();
    } catch {
      setFeedback(t('Cererea a eșuat. Încercați din nou.', 'The request failed. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="promo-panel"
      data-tour="promo-panel"
      aria-labelledby={`promo-${propertyId}`}
    >
      {showEnvironmentNote ? (
        <p className="promo-eyebrow">POC / Simulare · {checkoutMode === 'stripe_test' ? 'Stripe Test' : t('simulare', 'simulation')}</p>
      ) : null}
      <h4 id={`promo-${propertyId}`}>
        {simulationOnly
          ? t('Promovare (simulare)', 'Promotion (simulation)')
          : t('Promovare 7 zile (POC / Simulare)', '7-day promotion (POC / Simulation)')}
      </h4>
      <p className="promo-copy">
        {simulationOnly
          ? t(
              'Flux demonstrativ: nu se percepe nicio taxă reală în acest mediu.',
              'Demonstration flow: no real charge is taken in this environment.',
            )
          : t(
              'Un singur preț acoperă ambele anunțuri legate (vânzare și închiriere). Sumă reală încasată acum: 0,00 EUR.',
              'A single price covers both linked listings (sale and rent). Real amount charged now: €0.00.',
            )}
      </p>
      {active ? (
        <p className="promo-active">
          <Sparkles size={14} />
          {t('Promovare activă (simulare) până la', 'Active promotion (simulation) until')}{' '}
          {new Date(String(active.expires_at ?? active.ends_at)).toLocaleString()}
        </p>
      ) : pending ? (
        <p className="promo-pending">
          {t(
            'Sesiune de test în curs. Finalizați checkout-ul sau așteptați expirarea automată (35 min).',
            'Test session in progress. Complete checkout or wait for auto-expiry (35 min).',
          )}
        </p>
      ) : (
        <>
          {canStartCheckout ? (
            <label className="promo-checkbox">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              <span>
                {checkoutMode === 'stripe_test'
                  ? t(
                      'Înțeleg că este mod test Stripe (POC / Simulare), fără taxă reală.',
                      'I understand this is Stripe test mode (POC / Simulation), with no real charge.',
                    )
                  : t(
                      'Înțeleg că aceasta este o simulare POC; nu se percepe nicio taxă reală.',
                      'I understand this is a POC simulation; no real charge is taken.',
                    )}
              </span>
            </label>
          ) : null}
          <button
            type="button"
            className="button secondary promo-action"
            disabled={!canStartCheckout || !accepted || busy || simulationOnly}
            onClick={startCheckout}
            aria-disabled={simulationOnly || !canStartCheckout}
          >
            {busy ? <LoaderCircle className="spin" size={16} /> : null}
            {simulationOnly
              ? t('Simulare — indisponibil aici', 'Simulation — unavailable here')
              : checkoutMode === 'mock'
                ? t('Simulează promovarea', 'Simulate promotion')
                : t('Pornește checkout test', 'Start test checkout')}
          </button>
        </>
      )}
      {feedback ? <p className="promo-feedback">{feedback}</p> : null}
      <style jsx>{`
        .promo-panel {
          margin-top: 18px;
          padding: 14px 16px;
          border: 1px solid #e3e6e1;
          border-radius: 12px;
          background: #f9faf8;
        }
        .promo-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.03em;
          color: #6a7874;
          margin: 0 0 8px;
        }
        h4 {
          margin: 0 0 6px;
          font-size: 14px;
          font-weight: 600;
        }
        .promo-copy,
        .promo-feedback,
        .promo-active,
        .promo-pending {
          font-size: 13px;
          color: #5a6462;
        }
        .promo-copy {
          margin: 0 0 12px;
        }
        .promo-checkbox {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .promo-active,
        .promo-pending {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .promo-feedback {
          margin: 10px 0 0;
        }
        .promo-action {
          font-size: 13px;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </section>
  );
}
