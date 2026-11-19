"use client";
import Link from 'next/link';
import { useEffect, useId, useState, type FormEvent } from 'react';
import type { SavedSearch, SavedSearchFilters } from '@/lib/saved-searches';
import { dateTime, money } from '@/lib/format';
import { buildAccountSignInUrl } from '@/lib/security';
import { ROMANIA_JUDETE } from '@/lib/judet';
import { buildSavedSearchPath } from '@/lib/saved-search-link';
import { usePlatform } from './platform';

type Snapshot = { userId: string; status: 'loading' | 'ready' | 'unavailable'; rows: SavedSearch[] };
export function SavedSearches({ initialFilters = {}, invalidQuery = false }: { initialFilters?: SavedSearchFilters; invalidQuery?: boolean }) {
  const { viewer, configured, t, language } = usePlatform();
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot>({ userId: '', status: 'loading', rows: [] });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const userId = viewer?.id || '';
  const countyListId = useId();
  useEffect(() => {
    if (!configured || !userId) return;
    const controller = new AbortController();
    async function load() {
      if (controller.signal.aborted) return;
      setSnapshot({ userId, status: 'loading', rows: [] });
      try {
        const response = await fetch('/api/saved-searches', { cache: 'no-store', signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.data)) throw new Error();
        if (!controller.signal.aborted) setSnapshot({ userId, status: 'ready', rows: body.data });
      } catch { if (!controller.signal.aborted) setSnapshot({ userId, status: 'unavailable', rows: [] }); }
    }
    queueMicrotask(() => void load());
    return () => controller.abort();
  }, [configured, userId, revision]);
  const current: Snapshot = snapshot.userId === userId ? snapshot : { userId, status: 'loading', rows: [] };
  const canEdit = configured && !!userId && !busy && current.status === 'ready';
  async function mutate(method: 'POST' | 'DELETE', data: object) {
    setBusy(true); setFeedback('');
    try {
      const response = await fetch('/api/saved-searches', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const body = await response.json();
      if (!response.ok) {
        setFeedback(body.error === 'Saved search limit reached' ? 'limit' : body.error === 'Saved search capacity reached' ? 'capacity' : body.error === 'Verified email required' || body.error === 'Verify your email before making changes.' ? 'verify' : response.status === 401 ? 'signin' : response.status === 400 ? 'invalid' : 'unavailable');
        return;
      }
      setFeedback(method === 'POST' ? 'saved' : 'deleted');
      setRevision(value => value + 1);
    } catch { setFeedback('unavailable'); } finally { setBusy(false); }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) || '').trim();
    const filters: SavedSearchFilters = {};
    if (text('transaction_type') === 'sale' || text('transaction_type') === 'rent') filters.transaction_type = text('transaction_type') as 'sale' | 'rent';
    if (text('judet')) filters.judet = text('judet');
    if (text('neighborhood')) filters.neighborhood = text('neighborhood');
    if (text('min_price')) filters.min_price_minor = Math.round(Number(text('min_price')) * 100);
    if (text('max_price')) filters.max_price_minor = Math.round(Number(text('max_price')) * 100);
    if (text('min_rooms')) filters.min_rooms = Number(text('min_rooms'));
    void mutate('POST', { name: text('name'), filters });
  }
  const message = feedback === 'saved' ? t('Căutare salvată.', 'Search saved.') : feedback === 'deleted' ? t('Căutare ștearsă.', 'Search deleted.') : feedback === 'limit' ? t('Ai atins limita de cinci căutări. Șterge una pentru a salva alta.', 'You have reached five searches. Delete one before saving another.') : feedback === 'capacity' ? t('Capacitatea prototipului a fost atinsă. Reîncearcă mai târziu.', 'The prototype has reached capacity. Please try later.') : feedback === 'verify' ? t('Verifică emailul înainte de a salva căutări.', 'Verify your email before saving searches.') : feedback === 'signin' ? t('Intră din nou în cont.', 'Please sign in again.') : feedback === 'invalid' ? t('Verifică filtrele și limitele de preț.', 'Check your filters and price bounds.') : feedback ? t('Conexiune indisponibilă. Reîncearcă.', 'Connection unavailable. Please retry.') : '';
  return <main id="main" className="workspace-page page-width">
    <span className="eyebrow">POC / Simulare</span>
    <h1>{t('Căutări salvate', 'Saved searches')}</h1>
    <p>{t('Salvează filtre publice și primește actualizări generale când prețul sau starea unui anunț relevant se schimbă.', 'Save public filters and receive generic updates when a relevant listing changes price or status.')}</p>
    <p className="small">{t('Maximum cinci căutări pe cont; o alertă pe căutare pe oră și maximum cinci alerte pe cont pe oră. Emailul trebuie verificat. Livrarea poate fi întârziată în POC.', 'Up to five searches per account; one alert per search per hour and at most five alerts per account per hour. Verified email required. Delivery may be delayed in the POC.')}</p>
    {!configured || !viewer ? <section className="workspace-section">
      <p>{configured ? t('Intră în cont pentru a salva căutări.', 'Sign in to save searches.') : t('Catalog demonstrativ. Salvarea și alertele necesită un backend configurat.', 'Demo catalogue. Saving and alerts require a configured backend.')}</p>
      <Link className="button primary" href={buildAccountSignInUrl(buildSavedSearchPath(initialFilters))}>{t('Intră în cont', 'Sign in')}</Link>
    </section> : <>
      {invalidQuery && <p role="alert">{t('Linkul conține filtre nevalide. Verifică formularul înainte de a salva.', 'The link contains invalid filters. Review the form before saving.')}</p>}
      <section className="workspace-section">
        <h2>{t('Salvează această căutare', 'Save this search')}</h2>
        <form key={userId} className="stack-form" onSubmit={save}>
          <label>{t('Numele căutării', 'Search name')}<input name="name" required maxLength={80} /></label>
          <div className="grid gap-4 md:grid-cols-2">
            <label>{t('Tip tranzacție', 'Transaction type')}<select name="transaction_type" defaultValue={initialFilters.transaction_type || ''}><option value="">{t('Vânzare și închiriere', 'Sale and rent')}</option><option value="sale">{t('Vânzare', 'Sale')}</option><option value="rent">{t('Închiriere', 'Rent')}</option></select></label>
            <label>{t('Județ', 'County')}<input name="judet" defaultValue={initialFilters.judet || ''} maxLength={40} placeholder="București" list={countyListId} /></label>
            <datalist id={countyListId}>{ROMANIA_JUDETE.map(county => <option key={county} value={county} />)}</datalist>
            <label>{t('Cartier', 'Neighborhood')}<input name="neighborhood" defaultValue={initialFilters.neighborhood || ''} minLength={2} maxLength={100} /></label>
            <label>{t('Camere minime', 'Minimum rooms')}<input name="min_rooms" type="number" min="0" max="100" step="1" defaultValue={initialFilters.min_rooms} /></label>
            <label>{t('Preț minim, EUR', 'Minimum price, EUR')}<input name="min_price" type="number" min="0" step="0.01" max="10000000000" defaultValue={initialFilters.min_price_minor === undefined ? '' : initialFilters.min_price_minor / 100} /></label>
            <label>{t('Preț maxim, EUR', 'Maximum price, EUR')}<input name="max_price" type="number" min="0" step="0.01" max="10000000000" defaultValue={initialFilters.max_price_minor === undefined ? '' : initialFilters.max_price_minor / 100} /></label>
          </div>
          <p className="small">{t('Chiriile sunt lunare; prețurile de vânzare sunt totale. Filtrele nu folosesc adrese exacte sau oferte confidențiale.', 'Rental prices are monthly; sale prices are totals. Filters do not use exact addresses or confidential offers.')}</p>
          <button className="button primary" disabled={!canEdit}>{busy ? t('Se salvează…', 'Saving…') : t('Salvează căutarea', 'Save search')}</button>
        </form>
      </section>
      {message && <p role={feedback === 'saved' || feedback === 'deleted' ? 'status' : 'alert'}>{message}</p>}
      <section className="workspace-section">
        <h2>{t('Căutările tale', 'Your searches')}</h2>
        <button type="button" className="button secondary" disabled={busy || current.status === 'loading'} onClick={() => setRevision(value => value + 1)}>{t('Actualizează', 'Refresh')}</button>
        {current.status === 'loading' && <p role="status">{t('Se încarcă…', 'Loading…')}</p>}
        {current.status === 'unavailable' && <p role="alert">{t('Căutările nu sunt disponibile. Reîncearcă.', 'Searches are unavailable. Please retry.')}</p>}
        {current.status === 'ready' && current.rows.length === 0 && <p>{t('Nu ai încă nicio căutare salvată.', 'You have no saved searches yet.')}</p>}
        {current.rows.map(search => <article className="workspace-section" key={search.id} data-testid={`saved-search-${search.id}`}>
          <h3>{search.name}</h3>
          <p>{search.filters.transaction_type === 'sale' ? t('Vânzare', 'Sale') : search.filters.transaction_type === 'rent' ? t('Închiriere', 'Rent') : t('Vânzare și închiriere', 'Sale and rent')}{search.filters.judet ? ` · ${search.filters.judet}` : ''}{search.filters.neighborhood ? ` · ${search.filters.neighborhood}` : ''}</p>
          {search.filters.min_price_minor !== undefined && <p>{t('Preț minim:', 'Minimum price:')} {money(search.filters.min_price_minor, language)}</p>}
          {search.filters.max_price_minor !== undefined && <p>{t('Preț maxim:', 'Maximum price:')} {money(search.filters.max_price_minor, language)}</p>}
          {search.filters.min_rooms !== undefined && <p>{t('Camere minime:', 'Minimum rooms:')} {search.filters.min_rooms}</p>}
          <p className="small">{search.last_notified_at ? `${t('Ultima alertă pusă în coadă:', 'Last alert queued:')} ${dateTime(search.last_notified_at, language)}` : t('Nicio alertă pusă în coadă încă.', 'No alert queued yet.')}</p>
          <button type="button" className="button secondary" disabled={!canEdit} onClick={() => void mutate('DELETE', { id: search.id })}>{t('Șterge căutarea', 'Delete search')}</button>
        </article>)}
      </section>
    </>}
    <Link className="text-link" href="/">{t('Explorează anunțurile', 'Browse listings')}</Link>
  </main>;
}
