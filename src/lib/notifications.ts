import { normalizeHostname, stagingOutboxProductionHostAllowedForConfiguredApp } from '@/lib/payments/stripe-guard';

export interface OutboxItem {id:string;email:string;event:string;entity_id:string|null;lease_token:string;}
export type EmailContent = {subject:string;text:string};
export type EmailDeliveryMode = 'resend'|'staging_outbox'|'unavailable';

export type DeliveryEnv = {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_DELIVERY_MODE?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
  APP_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
};

function appHostnameFromEnv(env: DeliveryEnv): string | null {
  const configured = env.APP_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim();
  return normalizeHostname(configured || null);
}

function isProductionRuntime(env: DeliveryEnv): boolean {
  const vercelEnv = env.VERCEL_ENV?.trim();
  if (vercelEnv === 'production') return true;
  if (!vercelEnv && env.NODE_ENV === 'production') return true;
  return false;
}

function stagingOutboxHostAllowed(env: DeliveryEnv, requestHost: string | null | undefined): boolean {
  if (env.EMAIL_DELIVERY_MODE !== 'staging_outbox') return false;
  return stagingOutboxProductionHostAllowedForConfiguredApp(appHostnameFromEnv(env), requestHost);
}

export function resendEmailConfigured(env: DeliveryEnv = process.env as DeliveryEnv): boolean {
  const key = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  return Boolean(key && from);
}

export function resolveEmailDeliveryMode(
  env: DeliveryEnv = process.env as DeliveryEnv,
  requestHost?: string | null,
): EmailDeliveryMode {
  if (isProductionRuntime(env)) {
    if (env.EMAIL_DELIVERY_MODE === 'staging_outbox' && stagingOutboxHostAllowed(env, requestHost)) {
      return 'staging_outbox';
    }
    if (resendEmailConfigured(env)) return 'resend';
    return 'unavailable';
  }
  if (env.EMAIL_DELIVERY_MODE === 'staging_outbox') return 'staging_outbox';
  return resendEmailConfigured(env) ? 'resend' : 'staging_outbox';
}

type PreviewStore = (item: OutboxItem, content: EmailContent) => Promise<void>;
type ResendTransport = (item: OutboxItem, content: EmailContent) => Promise<void>;

export function createOutboxSender(
  mode: EmailDeliveryMode,
  deps: {
    origin: string;
    from: string;
    resendApiKey: string;
    storePreview: PreviewStore;
    sendResend?: ResendTransport;
  },
) {
  return async (item: OutboxItem) => {
    if (mode === 'unavailable') throw new Error('Email delivery unavailable.');
    const content = notificationEmail(item.event, deps.origin);
    if (mode === 'staging_outbox') {
      await deps.storePreview(item, content);
      return;
    }
    const send = deps.sendResend ?? defaultResendSend(deps.resendApiKey, deps.from);
    await send(item, content);
  };
}

function defaultResendSend(apiKey: string, from: string): ResendTransport {
  return async (item, content) => {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `licitatiero-outbox-${item.id}`,
      },
      body: JSON.stringify({ from, to: [item.email], subject: content.subject, text: content.text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Email delivery deferred.');
  };
}

export async function deliverBatch(
  items: OutboxItem[],
  send: (item: OutboxItem) => Promise<void>,
  finish: (item: OutboxItem, delivered: boolean) => Promise<boolean>,
) {
  const outcomes = await Promise.all(
    items.map(async (item) => {
      let delivered = false;
      try {
        await send(item);
        delivered = true;
      } catch {
        /* The leased row remains retryable. Never log private provider payloads. */
      }
      const finished = await finish(item, delivered);
      return finished ? (delivered ? 'sent' : 'retry') : 'stale';
    }),
  );
  return {
    sent: outcomes.filter((v) => v === 'sent').length,
    retry: outcomes.filter((v) => v === 'retry').length,
    stale: outcomes.filter((v) => v === 'stale').length,
  };
}

export function notificationEmail(event: string, origin: string) {
  const names: Record<string, string> = {
    'message.received': 'mesaj nou / new message',
    'bid.placed': 'ofertă nouă / new offer',
    'auction.invited': 'invitație / invitation',
    'auction.closed': 'licitație încheiată / auction ended',
    'viewing.requested': 'vizionare solicitată / viewing requested',
    'search.updated': 'căutare actualizată / saved search update',
  };
  const subject = `LicitatieRO — ${Object.hasOwn(names, event) ? names[event] : 'actualizare / account update'}`;
  const text = `Ai o actualizare în contul LicitatieRO. / You have an update in your LicitatieRO account.\n\n${new URL('/workspace', origin).href}\n\nRezervările din această versiune sunt simulări; nu se transferă bani. / Reservations in this version are simulations; no money moves.`;
  return { subject, text };
}

export function maskEmailAddress(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const head = local.length ? local[0] : '*';
  return `${head}***@${domain}`;
}
