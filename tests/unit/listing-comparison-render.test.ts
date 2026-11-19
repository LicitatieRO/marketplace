import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { ListingComparison } from '@/components/listing-comparison';
import type { ComparisonListing } from '@/lib/listing-comparison';

const { locale } = vi.hoisted(() => ({ locale: { language: 'ro' as 'ro' | 'en' } }));
vi.mock('@/components/platform', () => ({ usePlatform: () => ({ language: locale.language, t: (ro: string, en: string) => locale.language === 'ro' ? ro : en }) }));

const originalTimezone = process.env.TZ;
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

it.each(['ro', 'en'] as const)('renders the same initial snapshot in UTC and Bucharest browsers (%s)', language => {
  locale.language = language;
  const listing: ComparisonListing = {
    id: '20000000-0000-4000-8000-000000000001', propertyId: '10000000-0000-4000-8000-000000000001',
    title: 'Public home', transactionType: 'sale', priceMinor: 10000000, areaSqm: 60, rooms: 2,
    propertyType: 'apartment', neighborhood: 'Cotroceni', judet: 'București', tenancy: 'vacant', auctionMode: null, auctionState: 'none',
  };
  const render = () => renderToStaticMarkup(createElement(ListingComparison, {
    options: [listing], selected: [listing, { ...listing, id: '30000000-0000-4000-8000-000000000001', transactionType: 'rent' }],
    query: { kind: 'empty' }, sampledAt: '2026-11-16T10:30:00Z', unavailable: false,
  }));
  process.env.TZ = 'UTC';
  const server = render();
  process.env.TZ = 'Europe/Bucharest';
  expect(render()).toBe(server);
});
