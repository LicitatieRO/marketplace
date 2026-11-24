'use client';

import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { Feedback, usePlatform } from '@/components/platform';
import {
  dsaElements,
  dsaReasons,
  type DsaElement,
  type DsaReason,
} from '@/lib/dsa-notices';
import { dsaElementLabel, dsaReasonLabel } from '@/lib/dsa-notice-copy';
import { dateTime } from '@/lib/format';

type Props = {
  listingId: string;
  listingUrl: string;
  defaultExplanation?: string;
};

export function DsaReportForm({
  listingId,
  listingUrl,
  defaultExplanation,
}: Props) {
  const { t, language } = usePlatform();
  const [reason, setReason] = useState<DsaReason>('fraud');
  const [element, setElement] = useState<DsaElement>('whole_listing');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{ id: string; listing_url: string; created_at: string } | null>(null);
  const csam = reason === 'csam';
  const identityRequired = !csam;

  const receiptLine = useMemo(() => {
    if (!receipt) return '';
    const when = dateTime(receipt.created_at, language);
    return t(
      `Am primit notificarea ta (nr. ${receipt.id}) privind anunțul ${receipt.listing_url}, la ${when}. O vom analiza în timp util și îți vom comunica decizia la această adresă de e-mail. Nu este necesar să ne trimiți notificarea din nou.`,
      `We received your notice (ref. ${receipt.id}) about listing ${receipt.listing_url} on ${when}. We will review it in a timely manner and email you our decision. There is no need to submit it again.`,
    );
  }, [language, receipt, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = event.currentTarget;
    const body = {
      listing_id: listingId,
      element,
      reason,
      explanation: String(new FormData(form).get('explanation') ?? ''),
      notifier_name: identityRequired ? String(new FormData(form).get('notifier_name') ?? '') : undefined,
      notifier_email: identityRequired ? String(new FormData(form).get('notifier_email') ?? '') : undefined,
      good_faith: true,
    };
    try {
      const response = await fetch('/api/dsa-notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(typeof json.error === 'string' ? json.error : t('Cererea nu a putut fi trimisă.', 'The notice could not be submitted.'));
        return;
      }
      setReceipt(json.data);
    } catch {
      setError(t('Cererea nu a putut fi trimisă.', 'The notice could not be submitted.'));
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <section className="workspace-section" data-testid="dsa-report-receipt">
        <p role="status">{receiptLine}</p>
        <Link className="button secondary" href={`/listings/${listingId}`}>
          {t('Înapoi la anunț', 'Back to listing')}
        </Link>
      </section>
    );
  }

  return (
    <form className="workspace-section dsa-report-form" onSubmit={submit} data-testid="dsa-report-form">
      <p>
        {t(
          'Folosește acest formular dacă un anunț conține informații pe care le consideri ilegale. Vom analiza notificarea cu atenție și obiectivitate.',
          'Use this form if a listing contains information you believe is illegal. We will review your notice diligently and objectively.',
        )}
      </p>
      <label>
        {t('Anunț', 'Listing')}
        <input name="listing_url" value={listingUrl} readOnly aria-readonly />
      </label>
      <label>
        {t('Ce anume raportezi?', 'What exactly are you reporting?')}
        <select value={element} onChange={(event) => setElement(event.target.value as DsaElement)} required>
          {dsaElements.map((value) => (
            <option key={value} value={value}>
              {dsaElementLabel(language, value)}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>{t('Motiv', 'Reason')}</legend>
        {dsaReasons.map((value) => (
          <label key={value} className="inline-choice">
            <input
              type="radio"
              name="reason"
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
              required
            />
            {dsaReasonLabel(language, value)}
          </label>
        ))}
      </fieldset>
      <label>
        {t(
          'Explică de ce consideri că acest conținut este ilegal. Include detaliile relevante (de ex. dovezi, legea încălcată, dacă o cunoști).',
          'Explain why you believe this content is illegal. Include relevant details (e.g. evidence, the law breached, if you know it).',
        )}
        <textarea
          name="explanation"
          minLength={30}
          maxLength={5000}
          required
          rows={6}
          defaultValue={defaultExplanation ?? ""}
        />
      </label>
      <label>
        {t('Nume', 'Name')}
        <input name="notifier_name" required={identityRequired} disabled={csam} maxLength={160} />
      </label>
      <label>
        {t('E-mail', 'E-mail')}
        <input
          name="notifier_email"
          type="email"
          required={identityRequired}
          disabled={csam}
          maxLength={254}
        />
        <span className="muted">
          {t(
            'Folosim datele tale doar pentru a procesa notificarea și a-ți comunica decizia.',
            'We use your details only to process this notice and tell you our decision.',
          )}
        </span>
        {csam && (
          <span className="muted">
            {t('Poți trimite această notificare anonim.', 'You may submit this notice anonymously.')}
          </span>
        )}
      </label>
      <label className="inline-choice">
        <input type="checkbox" name="good_faith" value="yes" required data-testid="dsa-good-faith" />
        {t(
          'Declar că am convingerea, cu bună-credință, că informațiile și afirmațiile din această notificare sunt exacte și complete.',
          'I confirm my good-faith belief that the information and allegations in this notice are accurate and complete.',
        )}
      </label>
      <p className="muted">
        {t(
          'Notificările abuzive sau vădit nefondate repetate pot duce la ignorarea notificărilor viitoare. Prelucrarea datelor: vezi Politica de confidențialitate.',
          'Repeated abusive or manifestly unfounded notices may lead to future notices being disregarded. Data processing: see the Privacy Policy.',
        )}{' '}
        <Link href="/legal/privacy">{t('Politica de confidențialitate', 'Privacy Policy')}</Link>
      </p>
      <button className="button primary" type="submit" disabled={busy} data-testid="dsa-report-submit">
        {busy ? t('Se trimite…', 'Submitting…') : t('Trimite notificarea', 'Submit notice')}
      </button>
      <Feedback error={error} />
    </form>
  );
}
