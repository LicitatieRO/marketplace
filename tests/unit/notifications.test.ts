import { describe, expect, it, vi } from 'vitest';
import {
  createOutboxSender,
  deliverBatch,
  maskEmailAddress,
  notificationEmail,
  resolveEmailDeliveryMode,
  resendEmailConfigured,
  type DeliveryEnv,
} from '@/lib/notifications';

const STAGING = 'licitatiero-staging.vercel.app';

function prodEnv(overrides: Partial<DeliveryEnv> = {}): DeliveryEnv {
  return {
    VERCEL_ENV: 'production',
    APP_URL: `https://${STAGING}`,
    NODE_ENV: 'production',
    ...overrides,
  };
}

describe('email delivery mode (fail-closed on production)', () => {
  it('uses Resend when API key and from address are set in non-production', () => {
    expect(resendEmailConfigured({ RESEND_API_KEY: 're_test', EMAIL_FROM: 'noreply@test.local' })).toBe(true);
    expect(
      resolveEmailDeliveryMode({ RESEND_API_KEY: 're_test', EMAIL_FROM: 'noreply@test.local', VERCEL_ENV: 'preview' }),
    ).toBe('resend');
  });

  it('non-prod: forces staging_outbox when EMAIL_DELIVERY_MODE is set', () => {
    expect(
      resolveEmailDeliveryMode({
        EMAIL_DELIVERY_MODE: 'staging_outbox',
        RESEND_API_KEY: 're_test',
        EMAIL_FROM: 'a@b.c',
        VERCEL_ENV: 'preview',
      }),
    ).toBe('staging_outbox');
  });

  it('non-prod: falls back to staging_outbox when Resend vars are unset', () => {
    expect(resolveEmailDeliveryMode({ VERCEL_ENV: 'development' })).toBe('staging_outbox');
    expect(resolveEmailDeliveryMode({ RESEND_API_KEY: 'only-key', VERCEL_ENV: 'development' })).toBe('staging_outbox');
  });

  it('prod + flag + staging APP_URL + matching host → staging_outbox', () => {
    expect(
      resolveEmailDeliveryMode(
        prodEnv({ EMAIL_DELIVERY_MODE: 'staging_outbox' }),
        STAGING,
      ),
    ).toBe('staging_outbox');
  });

  it('prod + flag + wrong APP_URL → resend when configured, never staging_outbox', () => {
    expect(
      resolveEmailDeliveryMode(
        prodEnv({
          EMAIL_DELIVERY_MODE: 'staging_outbox',
          APP_URL: 'https://licitatiero.ro',
          RESEND_API_KEY: 're_123',
          EMAIL_FROM: 'from@test',
        }),
        STAGING,
      ),
    ).toBe('resend');
  });

  it('prod + flag + staging APP_URL + wrong request host → resend or unavailable, not outbox', () => {
    expect(
      resolveEmailDeliveryMode(
        prodEnv({ EMAIL_DELIVERY_MODE: 'staging_outbox', RESEND_API_KEY: 're_123', EMAIL_FROM: 'from@test' }),
        'evil.example',
      ),
    ).toBe('resend');
    expect(
      resolveEmailDeliveryMode(prodEnv({ EMAIL_DELIVERY_MODE: 'staging_outbox' }), 'evil.example'),
    ).toBe('unavailable');
  });

  it('prod + no Resend + no flag → unavailable', () => {
    expect(resolveEmailDeliveryMode(prodEnv())).toBe('unavailable');
  });

  it('prod + Resend configured → resend', () => {
    expect(
      resolveEmailDeliveryMode(
        prodEnv({ RESEND_API_KEY: 're_123', EMAIL_FROM: 'from@test' }),
        STAGING,
      ),
    ).toBe('resend');
  });

  it('NODE_ENV=production without VERCEL_ENV counts as production', () => {
    expect(
      resolveEmailDeliveryMode(
        { NODE_ENV: 'production', APP_URL: 'https://example.com' },
        undefined,
      ),
    ).toBe('unavailable');
  });
});

describe('outbox delivery', () => {
  it('acknowledges successful delivery and retries failed transport without claiming it delivered', async () => {
    const results: Record<string, boolean> = {};
    const result = await deliverBatch(
      [
        { id: '1', email: 'a@example.test', event: 'bid.placed', entity_id: 'private', lease_token: 'lease-a' },
        { id: '2', email: 'b@example.test', event: 'message.received', entity_id: 'private2', lease_token: 'lease-b' },
      ],
      async (item) => {
        if (item.id === '2') throw new Error('Provider unavailable');
      },
      async (item, delivered) => {
        results[item.id] = delivered;
        return true;
      },
    );
    expect(result).toEqual({ sent: 1, retry: 1, stale: 0 });
    expect(results).toEqual({ '1': true, '2': false });
  });

  it('does not report a stale claim as successfully finalized', async () => {
    const result = await deliverBatch(
      [{ id: '1', email: 'a@example.test', event: 'bid.placed', entity_id: null, lease_token: 'old' }],
      async () => {},
      async () => false,
    );
    expect(result).toEqual({ sent: 0, retry: 0, stale: 1 });
  });

  it('routes Resend mode through the Resend transport', async () => {
    const resend = vi.fn().mockResolvedValue(undefined);
    const store = vi.fn();
    const sender = createOutboxSender('resend', {
      origin: 'https://app.test',
      from: 'from@test',
      resendApiKey: 'key',
      storePreview: store,
      sendResend: resend,
    });
    const item = { id: '9', email: 'u@example.test', event: 'bid.placed', entity_id: null, lease_token: 't' };
    await sender(item);
    expect(resend).toHaveBeenCalledOnce();
    expect(store).not.toHaveBeenCalled();
  });

  it('routes staging mode through preview store only', async () => {
    const resend = vi.fn();
    const store = vi.fn().mockResolvedValue(undefined);
    const sender = createOutboxSender('staging_outbox', {
      origin: 'https://app.test',
      from: 'from@test',
      resendApiKey: 'key',
      storePreview: store,
      sendResend: resend,
    });
    const item = { id: '9', email: 'u@example.test', event: 'bid.placed', entity_id: null, lease_token: 't' };
    await sender(item);
    expect(store).toHaveBeenCalledOnce();
    expect(resend).not.toHaveBeenCalled();
  });

  it('leaves delivery unfinished when preview store fails', async () => {
    const store = vi.fn().mockRejectedValue(new Error('db down'));
    const sender = createOutboxSender('staging_outbox', {
      origin: 'https://app.test',
      from: 'from@test',
      resendApiKey: '',
      storePreview: store,
    });
    const finished: boolean[] = [];
    const result = await deliverBatch(
      [{ id: '1', email: 'a@example.test', event: 'bid.placed', entity_id: null, lease_token: 'lease' }],
      sender,
      async (_item, delivered) => {
        finished.push(delivered);
        return true;
      },
    );
    expect(result).toEqual({ sent: 0, retry: 1, stale: 0 });
    expect(finished).toEqual([false]);
  });

  it('does not reflect untrusted event content or origin query secrets in email', () => {
    const email = notificationEmail('secret address and\nBcc:attacker@example.test', 'https://licitatiero.ro/?token=secret');
    expect(email.subject).toBe('LicitatieRO — actualizare / account update');
    expect(email.text).toContain('https://licitatiero.ro/workspace');
    expect(email.text).not.toContain('token=secret');
    expect(email.subject).not.toContain('attacker');
  });

  it('masks recipient emails for display', () => {
    expect(maskEmailAddress('alice@example.test')).toBe('a***@example.test');
    expect(maskEmailAddress('Alice@EXAMPLE.com')).toBe('A***@EXAMPLE.com');
    expect(maskEmailAddress('bad')).toBe('***');
    expect(maskEmailAddress('@domain.com')).toBe('***');
    expect(maskEmailAddress('user@host@domain.test')).toBe('u***@host@domain.test');
    expect(maskEmailAddress('  ')).toBe('***');
  });
});