"use client";
import Link from 'next/link';
import { useId } from 'react';
import type { ComparisonListing, ComparisonQuery } from '@/lib/listing-comparison';
import { money } from '@/lib/format';
import { usePlatform } from './platform';

export function ListingComparison({ options, selected, query, sampledAt, unavailable }: { options: ComparisonListing[]; selected: ComparisonListing[]; query: ComparisonQuery; sampledAt: string; unavailable: boolean }) {
  const { t, language } = usePlatform();
  const selectorId = useId();
  const snapshotTime = new Intl.DateTimeFormat(language === 'ro' ? 'ro-RO' : 'en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest',
  }).format(new Date(sampledAt));
  const selectionIds = query.kind === 'ids' ? query.ids : selected.map(item => item.id);
  const linked = selected.filter(item => selected.some(other => other.id !== item.id && other.propertyId === item.propertyId && other.transactionType !== item.transactionType));
  const transaction = (item: ComparisonListing) => item.transactionType === 'sale' ? t('Vânzare', 'Sale') : t('Închiriere', 'Rent');
  const auctionState = (item: ComparisonListing) => item.auctionState === 'none' ? t('Fără licitație', 'No auction') : item.auctionState === 'invite' ? t('Invitație necesară', 'Invitation required') : item.auctionState === 'scheduled' ? t('Programată', 'Scheduled') : item.auctionState === 'ended' ? t('Termen depășit', 'Deadline passed') : item.auctionState === 'open' ? t('În intervalul programat', 'Within scheduled window') : t('Stare indisponibilă', 'State unavailable');
  const propertyType = (item: ComparisonListing) => item.propertyType === 'apartment' ? t('Apartament', 'Apartment') : item.propertyType === 'house' ? t('Casă', 'House') : item.propertyType === 'studio' ? t('Garsonieră', 'Studio') : item.propertyType === 'land' ? t('Teren', 'Land') : item.propertyType === 'commercial' ? t('Comercial', 'Commercial') : '—';
  const rows = [
    { key: 'price', label: t('Preț afișat', 'Listing price'), cell: (item: ComparisonListing) => <>{money(item.priceMinor, language)} <span className="block text-xs">{item.transactionType === 'rent' ? t('/ lună', '/ month') : t('total', 'total')}</span></> },
    { key: 'area', label: t('Suprafață utilă', 'Usable area'), cell: (item: ComparisonListing) => item.areaSqm === null ? '—' : `${item.areaSqm} m²` },
    { key: 'rooms', label: t('Camere', 'Rooms'), cell: (item: ComparisonListing) => item.rooms ?? '—' },
    { key: 'type', label: t('Tip proprietate', 'Property type'), cell: propertyType },
    { key: 'area-name', label: t('Zonă publică', 'Public area'), cell: (item: ComparisonListing) => [item.neighborhood, item.judet].filter(Boolean).join(' · ') || '—' },
    { key: 'tenancy', label: t('Ocupare declarată', 'Disclosed occupancy'), cell: (item: ComparisonListing) => item.tenancy === 'occupied' ? t('Ocupată', 'Occupied') : item.tenancy === 'vacant' ? t('Liberă', 'Vacant') : t('Nespecificată', 'Unspecified') },
    { key: 'auction', label: t('Licitație · instantaneu', 'Auction · snapshot'), cell: (item: ComparisonListing) => <>{item.auctionMode === 'sealed' ? t('Oferte confidențiale · ', 'Confidential offers · ') : item.auctionMode === 'ascending' ? t('Ascendentă · ', 'Ascending · ') : ''}{auctionState(item)}</> },
  ];
  return <main id="main" className="workspace-page page-width">
    <span className="eyebrow">POC / Simulare</span>
    <h1>{t('Compară locuințe', 'Compare listings')}</h1>
    <p>{t('Alege două sau trei anunțuri publicate. Compară proprietăți diferite sau vânzarea și închirierea aceleiași proprietăți.', 'Choose two or three published listings. Compare different properties or sale and rent of the same property.')}</p>
    {unavailable && <p role="alert">{t('Catalogul nu este disponibil. Reîncarcă pagina mai târziu.', 'The catalogue is unavailable. Reload this page later.')}</p>}
    {query.kind === 'invalid' && <p role="alert">{t('Alege două sau trei anunțuri distincte ori o singură proprietate. Linkul de comparație nu este valid.', 'Choose two or three distinct listings or one property. This comparison link is invalid.')}</p>}
    {!unavailable && query.kind !== 'empty' && query.kind !== 'invalid' && (selected.length < 2 || query.kind === 'ids' && selected.length !== query.ids.length) && <p role="status">{t('Unele selecții nu sunt publicate sau nu sunt disponibile. Alege alte anunțuri din listă.', 'Some selections are unpublished or unavailable. Choose other listings from the list.')}</p>}
    <section className="workspace-section">
      <h2>{t('Alege anunțurile', 'Choose listings')}</h2>
      <form action="/compare" method="get" className="stack-form">
        <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(index => <div key={index} className="grid gap-2">
          <label htmlFor={`${selectorId}-${index}`}>{t(`Anunț ${index + 1}${index === 2 ? ' (opțional)' : ''}`, `Listing ${index + 1}${index === 2 ? ' (optional)' : ''}`)}</label>
          <select id={`${selectorId}-${index}`} name="ids" required={index < 2} defaultValue={selectionIds[index] || ''}>
            <option value="">{t('Alege un anunț', 'Choose a listing')}</option>
            {options.map(item => <option key={item.id} value={item.id}>{transaction(item)} · {item.title}</option>)}
          </select>
        </div>)}</div>
        <button className="button primary" disabled={options.length < 2}>{t('Compară', 'Compare')}</button>
      </form>
    </section>
    {linked.length > 0 && selected.length >= 2 && <p data-testid="linked-comparison" className="workspace-section">{t('Vânzarea și închirierea marcate se referă la aceeași proprietate fizică. Prețul de vânzare este total; chiria este lunară.', 'The marked sale and rent listings refer to the same physical property. The sale price is a total; rent is monthly.')}</p>}
    {selected.length >= 2 && selected.length <= 3 && <section className="workspace-section">
      <p className="small">{t('Instantaneu la', 'Snapshot at')} <time dateTime={sampledAt}>{snapshotTime} (Europe/Bucharest)</time>. {t('Deschide anunțul pentru ora și eligibilitatea actuale. Comparația nu garantează acceptarea unei oferte și nu estimează randamente.', 'Open a listing for current timing and eligibility. This comparison does not guarantee offer acceptance or estimate returns.')}</p>
      <div className="max-w-full overflow-x-auto" role="region" tabIndex={0} aria-label={t('Tabel comparativ', 'Comparison table')}>
        <table className="w-full min-w-[560px] border-collapse text-left" data-testid="comparison-table">
          <caption className="sr-only">{t('Compararea anunțurilor publicate', 'Published listing comparison')}</caption>
          <thead><tr><th scope="col" className="border-b border-[var(--line)] p-3">{t('Caracteristică', 'Feature')}</th>{selected.map(item => <th scope="col" key={item.id} className={`border-b border-[var(--line)] p-3 ${linked.some(row => row.id === item.id) ? 'bg-[var(--soft)]' : ''}`}>
            <Link href={`/listings/${item.id}`}>{item.title}</Link><span className="block text-sm">{transaction(item)}</span>{linked.some(row => row.id === item.id) && <span className="block text-xs">{t('Aceeași proprietate', 'Same property')}</span>}
          </th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.key} data-testid={`comparison-${row.key}`}><th scope="row" className="border-b border-[var(--line)] p-3 font-medium">{row.label}</th>{selected.map(item => <td key={item.id} className="border-b border-[var(--line)] p-3 align-top">{row.cell(item)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>}
    <Link className="text-link" href="/">{t('Înapoi la anunțuri', 'Back to listings')}</Link>
  </main>;
}
