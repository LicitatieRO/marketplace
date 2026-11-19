'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Feedback, usePlatform } from '@/components/platform';
import type { DsaNoticeRow, DsaStatus } from '@/lib/dsa-notices';
import { dsaDecisions, dsaGroundTypes, dsaStatuses, type DsaDecision, type DsaGroundType } from '@/lib/dsa-notices';
import { dsaElementLabel, dsaReasonLabel } from '@/lib/dsa-notice-copy';
import { dsaDecisionLabel, pickBilingualBody, renderNotifierDecisionEmail, renderOwnerStatementOfReasons } from '@/lib/dsa-notice-templates';
import { dateTime } from '@/lib/format';

type Summary = {
  id: string;
  listing_url: string;
  element: DsaNoticeRow['element'];
  reason: DsaNoticeRow['reason'];
  status: DsaStatus;
  decision?: DsaDecision | null;
  escalate_art18: boolean;
  created_at: string;
};

const statusSteps: { key: DsaStatus; ro: string; en: string }[] = [
  { key: 'received', ro: 'Primită', en: 'Received' },
  { key: 'under_review', ro: 'În analiză', en: 'Under review' },
  { key: 'decided', ro: 'Decizie și motivare (DSA art. 17)', en: 'Decision & statement of reasons (DSA Art. 17)' },
  { key: 'closed', ro: 'Închisă', en: 'Closed' },
];

export function FounderDsaNoticeQueue({ initialSection }: { initialSection: 'art16' | 'terms_breach' }) {
  const { t, language } = usePlatform();
  const [section, setSection] = useState(initialSection);
  const [status, setStatus] = useState<DsaStatus | 'all'>('all');
  const [rows, setRows] = useState<Summary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const query = useMemo(() => {
    const params = new URLSearchParams({ section });
    if (status !== 'all') params.set('status', status);
    return params.toString();
  }, [section, status]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/founder/dsa-notices?${query}`, { cache: 'no-store' });
        const json = await response.json();
        if (!response.ok) throw new Error(String(json.error ?? 'load_failed'));
        if (active) setRows(json.data ?? []);
      } catch {
        if (active) setError(t('Lista nu a putut fi încărcată.', 'The queue could not be loaded.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [query, t]);

  return (
    <main id="main" className="founder-shell">
      <div className="founder-inner">
        <Link href="/founder" className="back-link">
          ← Founder
        </Link>
        <section className="founder-intro" style={{ display: 'block', paddingTop: 28 }}>
          <h1>{t('Coadă notificări DSA', 'DSA notice queue')}</h1>
          <div className="filter-row">
            <button type="button" className={section === 'art16' ? 'button primary' : 'button secondary'} onClick={() => setSection('art16')}>
              {t('DSA art. 16', 'DSA Art. 16')}
            </button>
            <button type="button" className={section === 'terms_breach' ? 'button primary' : 'button secondary'} onClick={() => setSection('terms_breach')}>
              {t('Termeni platformă', 'Platform Terms')}
            </button>
            <label>
              {t('Filtru stare', 'Status filter')}
              <select value={status} onChange={(event) => setStatus(event.target.value as DsaStatus | 'all')}>
                <option value="all">{t('Toate', 'All')}</option>
                {dsaStatuses.map((value) => (
                  <option key={value} value={value}>
                    {statusSteps.find((step) => step.key === value) ? t(statusSteps.find((step) => step.key === value)!.ro, statusSteps.find((step) => step.key === value)!.en) : value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loading ? <p>{t('Se încarcă…', 'Loading…')}</p> : null}
          <Feedback error={error} />
          <ul className="dsa-queue-list">
            {rows.map((row) => (
              <li key={row.id}>
                <Link href={`/founder/dsa-notices/${row.id}`}>
                  <strong>{row.id.slice(0, 8)}</strong> · {dsaReasonLabel(language, row.reason)} · {dateTime(row.created_at, language)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

export function FounderDsaNoticeDetail({ noticeId }: { noticeId: string }) {
  const { t, language } = usePlatform();
  const [notice, setNotice] = useState<DsaNoticeRow | null>(null);
  const [status, setStatus] = useState<DsaStatus>('received');
  const [decision, setDecision] = useState<DsaDecision>('no_action');
  const [facts, setFacts] = useState('');
  const [groundType, setGroundType] = useState<DsaGroundType>('legal');
  const [ground, setGround] = useState('');
  const [automated, setAutomated] = useState(false);
  const [escalate, setEscalate] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [shortReason, setShortReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/founder/dsa-notices/${noticeId}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) {
        setError(String(json.error ?? 'load_failed'));
        return;
      }
      const row = json.data as DsaNoticeRow;
      setNotice(row);
      setStatus(row.status);
      setDecision((row.decision as DsaDecision) ?? 'no_action');
      setFacts(row.decision_facts ?? '');
      setGroundType((row.decision_ground_type as DsaGroundType) ?? 'legal');
      setGround(row.decision_ground ?? '');
      setAutomated(row.automated);
      setEscalate(row.escalate_art18);
      setEndDate(row.decision_end_at ? row.decision_end_at.slice(0, 16) : '');
    })();
  }, [noticeId]);

  const templates = useMemo(() => {
    if (!notice) return null;
    const notifierBodies = renderNotifierDecisionEmail({
      language,
      id: notice.id,
      decision,
      shortReason: shortReason || facts.slice(0, 160),
    });
    const ownerBodies = renderOwnerStatementOfReasons({
      listingUrl: notice.listing_url,
      decision,
      dateIso: notice.decided_at ?? new Date().toISOString(),
      endDateIso: endDate ? new Date(endDate).toISOString() : null,
      facts: facts || notice.explanation,
      groundType,
      ground: ground || '—',
      automated,
      followedNotice: true,
    });
    return {
      notifier: pickBilingualBody(notifierBodies, language),
      owner: pickBilingualBody(ownerBodies, language),
      notifierRo: notifierBodies.ro,
      notifierEn: notifierBodies.en,
      ownerRo: ownerBodies.ro,
      ownerEn: ownerBodies.en,
    };
  }, [automated, decision, endDate, facts, ground, groundType, language, notice, shortReason]);

  async function save() {
    if (!notice || !templates) return;
    setBusy(true);
    setError('');
    setMessage('');
    const patch = {
      status,
      decision: status === 'decided' || status === 'closed' ? decision : undefined,
      decision_facts: status === 'decided' || status === 'closed' ? facts : undefined,
      decision_ground_type: status === 'decided' || status === 'closed' ? groundType : undefined,
      decision_ground: status === 'decided' || status === 'closed' ? ground : undefined,
      decision_end_at: endDate ? new Date(endDate).toISOString() : null,
      automated,
      escalate_art18: escalate,
      notifier_email_rendered: `${templates.notifierRo}\n\n---\n\n${templates.notifierEn}`,
      owner_statement_rendered: `${templates.ownerRo}\n\n---\n\n${templates.ownerEn}`,
    };
    try {
      const response = await fetch('/api/founder/dsa-notices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notice.id, patch }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(String(json.error ?? 'save_failed'));
      setNotice(json.data);
      setMessage(t('Salvat.', 'Saved.'));
    } catch (cause) {
      setError(String(cause instanceof Error ? cause.message : t('Salvarea a eșuat.', 'Save failed.')));
    } finally {
      setBusy(false);
    }
  }

  if (!notice) {
    return <p>{error || t('Se încarcă…', 'Loading…')}</p>;
  }

  return (
    <main id="main" className="founder-shell">
      <div className="founder-inner">
        <Link href="/founder/dsa-notices" className="back-link">
          ← {t('Coadă notificări', 'Notice queue')}
        </Link>
        <section className="founder-intro" style={{ display: 'block', paddingTop: 28 }} data-testid="dsa-founder-detail">
          <h1>{notice.id}</h1>
          <p>{notice.listing_url}</p>
          <p>
            {dsaElementLabel(language, notice.element)} · {dsaReasonLabel(language, notice.reason)}
          </p>
          <ol className="dsa-status-steps">
            {statusSteps.map((step) => (
              <li key={step.key} className={status === step.key ? 'active' : ''}>
                {t(step.ro, step.en)}
              </li>
            ))}
          </ol>
          <label>
            {t('Stare', 'Status')}
            <select value={status} onChange={(event) => setStatus(event.target.value as DsaStatus)}>
              {dsaStatuses.map((value) => (
                <option key={value} value={value}>
                  {t(
                    statusSteps.find((step) => step.key === value)?.ro ?? value,
                    statusSteps.find((step) => step.key === value)?.en ?? value,
                  )}
                </option>
              ))}
            </select>
          </label>
          {(status === 'decided' || status === 'closed') && (
            <fieldset>
              <legend>{t('Decizie', 'Decision')}</legend>
              {dsaDecisions.map((value) => (
                <label key={value} className="inline-choice">
                  <input type="radio" name="decision" checked={decision === value} onChange={() => setDecision(value)} />
                  {dsaDecisionLabel(language, value)}
                </label>
              ))}
              <label>
                {t('Faptele avute în vedere', 'Facts relied on')}
                <textarea value={facts} onChange={(event) => setFacts(event.target.value)} minLength={10} rows={4} required />
              </label>
              <label>
                {t('Tip temei', 'Ground type')}
                <select value={groundType} onChange={(event) => setGroundType(event.target.value as DsaGroundType)}>
                  {dsaGroundTypes.map((value) => (
                    <option key={value} value={value}>
                      {value === 'legal' ? t('Legal', 'Legal') : t('Contractual', 'Contractual')}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('Temei', 'Ground')}
                <textarea value={ground} onChange={(event) => setGround(event.target.value)} minLength={3} rows={2} required />
              </label>
              <label>
                {t('Motiv scurt (notificator)', 'Short reason (notifier email)')}
                <input value={shortReason} onChange={(event) => setShortReason(event.target.value)} maxLength={500} />
              </label>
              <label>
                {t('Dată sfârșit (opțional)', 'End date (optional)')}
                <input type="datetime-local" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
              <label className="inline-choice">
                <input type="checkbox" checked={automated} onChange={(event) => setAutomated(event.target.checked)} />
                {t('Mijloace automate folosite', 'Automated means used')}
              </label>
            </fieldset>
          )}
          <label className="inline-choice">
            <input type="checkbox" checked={escalate} onChange={(event) => setEscalate(event.target.checked)} />
            {t('Sesizare autorități (DSA art. 18)', 'Escalate to authorities (DSA Art. 18)')}
          </label>
          <details>
            <summary>{t('Identitate notificator (intern)', 'Notifier identity (internal)')}</summary>
            <p>{notice.notifier_name || t('Anonim', 'Anonymous')}</p>
            <p>{notice.notifier_email || '—'}</p>
          </details>
          {templates && (
            <>
              <article className="workspace-section">
                <h2>{t('E-mail decizie (notificator)', 'Decision email (notifier)')}</h2>
                <pre>{templates.notifier}</pre>
              </article>
              <article className="workspace-section">
                <h2>{t('Motivare Art. 17 (proprietar)', 'Art. 17 statement (listing owner)')}</h2>
                <pre>{templates.owner}</pre>
                <p className="muted">
                  {t(
                    'Textul pentru proprietar nu include identitatea notificatorului.',
                    'Owner-facing text never includes notifier identity.',
                  )}
                </p>
              </article>
            </>
          )}
          <button type="button" className="button primary" disabled={busy} onClick={() => void save()}>
            {busy ? t('Se salvează…', 'Saving…') : t('Salvează', 'Save')}
          </button>
          <Feedback error={error} message={message} />
        </section>
      </div>
    </main>
  );
}
