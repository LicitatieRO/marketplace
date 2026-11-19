import { expect, it } from 'vitest';
import { createOutboxSender } from '@/lib/notifications';
it('keeps saved-search alerts generic, bilingual and preview-only in the sandbox', async () => {
  let content: { subject: string; text: string } | undefined;
  let providerCalls = 0;
  const send = createOutboxSender('staging_outbox', { origin: 'https://licitatiero.example', from: 'unused', resendApiKey: '', storePreview: async (_item, preview) => { content = preview; }, sendResend: async () => { providerCalls++; } });
  await send({ id: 'test-search-event', event: 'search.updated', entity_id: '41000000-0000-4000-8000-000000000001', email: 'sandbox@example.test', lease_token: 'local-fixture' });
  expect(providerCalls).toBe(0);
  expect(content?.subject).toContain('căutare actualizată / saved search update');
  expect(content?.text).toContain('https://licitatiero.example/workspace');
  expect(content?.text).not.toContain('41000000');
  expect(content?.text).not.toMatch(/min_price|neighborhood|€|sandbox@example/);
});
