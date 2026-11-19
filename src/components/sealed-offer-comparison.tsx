"use client";
import { useEffect, useId, useState } from 'react';
import { parseSealedOffers, sortSealedOffers, type SealedOffer, type SealedOfferSort } from '@/lib/sealed-offers';
import { dateTime, money } from '@/lib/format';
import { usePlatform } from './platform';

type Snapshot = { auctionId: string; status: 'loading' | 'ready' | 'forbidden' | 'unavailable'; rows: SealedOffer[] };
export function SealedOfferComparison({ auctionId, title }: { auctionId: string; title: string }) {
  const { t, language } = usePlatform();
  const sortId = useId();
  const [revision, setRevision] = useState(0);
  const [order, setOrder] = useState<SealedOfferSort>('timeDesc');
  const [snapshot, setSnapshot] = useState<Snapshot>({ auctionId, status: 'loading', rows: [] });
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      if (controller.signal.aborted) return;
      setSnapshot({ auctionId, status: 'loading', rows: [] });
      try {
        const response = await fetch(`/api/auctions/${auctionId}/sealed-offers`, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
        if (!response.ok) {
          if (!controller.signal.aborted) setSnapshot({ auctionId, status: response.status === 403 ? 'forbidden' : 'unavailable', rows: [] });
          return;
        }
        const body = await response.json();
        const rows = parseSealedOffers(body.data);
        if (!controller.signal.aborted) setSnapshot({ auctionId, status: 'ready', rows });
      } catch {
        if (!controller.signal.aborted) setSnapshot({ auctionId, status: 'unavailable', rows: [] });
      }
    }
    queueMicrotask(() => void load());
    return () => controller.abort();
  }, [auctionId, revision]);
  const current: Snapshot = snapshot.auctionId === auctionId ? snapshot : { auctionId, status: 'loading', rows: [] };
  const rows = sortSealedOffers(current.rows, order);
  return <section className="workspace-section" data-testid={`sealed-offers-${auctionId}`} aria-busy={current.status === 'loading'}>
    <span className="eyebrow">POC / Simulare</span>
    <h3>{t('Compară ofertele confidențiale', 'Compare confidential offers')}</h3>
    <p>{title}</p>
    <p className="small">{t('Sortarea nu selectează automat o ofertă. După închidere, folosește acțiunea explicită de selecție de mai jos.', 'Sorting never selects an offer automatically. After closing, use the explicit selection action below.')}</p>
    <div className="flex flex-wrap items-end gap-3">
      <label htmlFor={sortId}>{t('Sortează ofertele confidențiale', 'Sort confidential offers')}
        <select id={sortId} value={order} onChange={event => setOrder(event.currentTarget.value as SealedOfferSort)}>
          <option value="timeDesc">{t('Cele mai recente', 'Newest first')}</option>
          <option value="timeAsc">{t('Cele mai vechi', 'Oldest first')}</option>
          <option value="amountDesc">{t('Sumă: descrescător', 'Amount: highest first')}</option>
          <option value="amountAsc">{t('Sumă: crescător', 'Amount: lowest first')}</option>
        </select>
      </label>
      <button type="button" className="button secondary" disabled={current.status === 'loading'} onClick={() => setRevision(value => value + 1)}>{t('Actualizează ofertele', 'Refresh offers')}</button>
    </div>
    {current.status === 'loading' && <p role="status">{t('Se încarcă…', 'Loading…')}</p>}
    {current.status === 'forbidden' && <p role="alert">{t('Doar proprietarul sau personalul cu MFA verificat poate compara ofertele.', 'Only the owner or staff with verified MFA can compare these offers.')}</p>}
    {current.status === 'unavailable' && <p role="alert">{t('Ofertele nu sunt disponibile. Reîncearcă.', 'Offers are unavailable. Please retry.')}</p>}
    {current.status === 'ready' && rows.length === 0 && <p>{t('Nu există încă oferte confidențiale.', 'No confidential offers yet.')}</p>}
    {current.status === 'ready' && rows.length > 0 && <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t('Tabel de oferte confidențiale', 'Confidential offers table')}>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{title}</caption>
        <thead><tr>
          <th scope="col" className="border-b border-[var(--line)] p-3">{t('Participant', 'Bidder')}</th>
          <th scope="col" className="border-b border-[var(--line)] p-3">{t('Sumă', 'Amount')}</th>
          <th scope="col" className="border-b border-[var(--line)] p-3">{t('Trimisă la', 'Submitted at')}</th>
        </tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <th scope="row" className="border-b border-[var(--line)] p-3 font-normal break-words">{row.bidder_display_name || t('Participant', 'Bidder')}</th>
          <td className="border-b border-[var(--line)] p-3 whitespace-nowrap">{money(row.amount_minor, language)}</td>
          <td className="border-b border-[var(--line)] p-3 whitespace-nowrap"><time dateTime={row.created_at}>{dateTime(row.created_at, language)}</time></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
