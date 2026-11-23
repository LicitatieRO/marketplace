'use client';

import { useState } from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { usePlatform } from '@/components/platform';

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
}: {
  propertyId: string;
  promos: PromoRow[];
  onComplete: () => Promise<void>;
}) {
  const { t } = usePlatform();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const scoped = promos.filter((row) => String(row.property_id) === propertyId);
  const active = scoped.find(promoIsActive);
  const pending = scoped.find(promoIsPending);

  async function startCheckout() {
    if (!accepted || busy) return;
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
        if (body.error === 'payments_unavailable') {
          setFeedback(t('Plățile nu sunt disponibile în acest mediu.', 'Payments are unavailable in this environment.'));
        } else {
          setFeedback(body.error || t('Operațiune blocată.', 'Operation blocked.'));
        }
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
      <p className="promo-eyebrow">TEST MODE / MOD TEST · POC / Simulare</p>
      <h4 id={`promo-${propertyId}`}>
        {t(
          'POC / Simulare — promovare 10 € / 7 zile (previzualizare, fără facturare reală)',
          'POC / Simulation — €10 / 7-day promotion (preview, no live billing)',
        )}
      </h4>
      <p className="promo-copy">
        {t(
          'Un singur preț acoperă ambele anunțuri legate (vânzare și închiriere). În acest POC nu se facturează nimic; fluxul folosește mod test sau simulare deterministă.',
          'A single price covers both linked listings (sale and rent). This POC does not bill anyone; the flow uses test mode or deterministic simulation.',
        )}
      </p>
      <ul className="promo-facts">
        <li>{t('Mediu: Stripe Test Mode sau simulare', 'Environment: Stripe Test Mode or simulation')}</li>
        <li>{t('Preț afișat (simulare): 10 € / 7 zile', 'Displayed price (simulation): €10 / 7 days')}</li>
        <li>{t('Taxă reală încasată acum: 0,00 EUR', 'Real amount charged now: €0.00')}</li>
      </ul>
      {active ? (
        <p className="promo-active">
          <Sparkles size={14} />
          {t('Promovare activă (simulare) până la', 'Active promotion (simulation) until')}{' '}
          {new Date(String(active.expires_at ?? active.ends_at)).toLocaleString()}
        </p>
      ) : pending ? (
        <p className="promo-pending">
          {t('Sesiune de test în curs. Finalizați checkout-ul sau așteptați expirarea automată (35 min).', 'Test session in progress. Complete checkout or wait for auto-expiry (35 min).')}
        </p>
      ) : (
        <>
          <label className="promo-checkbox">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>
              {t(
                'Înțeleg că aceasta este o simulare POC în mod test, că nu voi fi taxat cu 10 € și că folosesc doar carduri de test.',
                'I understand this is a POC test-mode simulation, I will not be charged €10, and I will use test cards only.',
              )}
            </span>
          </label>
          <button type="button" className="button primary" disabled={!accepted || busy} onClick={startCheckout}>
            {busy ? <LoaderCircle className="spin" size={16} /> : null}
            {t(
              'Simulează promovarea în mod test — Nu se percepe nicio taxă reală',
              'Simulate promotion in test mode — No real charge',
            )}
          </button>
        </>
      )}
      {feedback ? <p className="promo-feedback">{feedback}</p> : null}
      <style jsx>{`
        .promo-panel {
          margin-top: 18px;
          padding: 16px;
          border: 1px dashed #c9a27c;
          border-radius: 12px;
          background: #fffaf4;
        }
        .promo-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #9a5b35;
          margin: 0 0 8px;
        }
        h4 {
          margin: 0 0 8px;
          font-size: 15px;
        }
        .promo-copy,
        .promo-facts,
        .promo-feedback,
        .promo-active,
        .promo-pending {
          font-size: 13px;
          color: #5a4a3f;
        }
        .promo-facts {
          padding-left: 18px;
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
