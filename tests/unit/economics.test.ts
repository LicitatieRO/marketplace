import { describe, expect, it } from 'vitest';
import { calculateChannel, calculatePromotions, calculateBudget, channelPresets, initialBudget } from '../../src/lib/economics';

describe('media funnel', () => {
  it('calculates Meta base spend through qualified inquiries without rounding the funnel', () => {
    expect(calculateChannel(channelPresets.base.meta)).toEqual({ impressions:150000, clicks:1500, inquiries:60, qualified:24, cpqi:50 });
  });
  it('preserves fractional TikTok expectations', () => {
    const result = calculateChannel(channelPresets.base.tiktok);
    expect(result.qualified).toBeCloseTo(4.2);
    expect(result.cpqi).toBeCloseTo(71.428571);
  });
  it('handles zero CPM and zero conversion without Infinity or misleading zero cost', () => {
    expect(calculateChannel({ spend:100, cpm:0, ctr:1, inquiryRate:4, qualificationRate:40 })).toEqual({ impressions:0, clicks:0, inquiries:0, qualified:0, cpqi:null });
    expect(calculateChannel({ ...channelPresets.base.meta, ctr:0 }).cpqi).toBeNull();
  });
  it('rejects invalid rates and nonfinite money', () => {
    expect(() => calculateChannel({ ...channelPresets.base.meta, ctr:101 })).toThrow();
    expect(() => calculateChannel({ ...channelPresets.base.meta, spend:NaN })).toThrow();
    expect(() => calculateChannel({ ...channelPresets.base.meta, spend:-1 })).toThrow();
  });
});

describe('physical-property promotions', () => {
  const input = { externalProperties:6, founderProperties:6, attachRate:10, netPrice:10, variableCost:1, overhead:500, salaries:0, taxRate:0 };
  it('excludes founder properties and charges once per physical property for seven days', () => {
    const result = calculatePromotions(input);
    expect(result.purchases).toBeCloseTo(.6);
    expect(result.contribution).toBeCloseTo(5.4);
    expect(result.breakEvenPurchases).toBe(56);
    expect(result.breakEvenProperties).toBe(560);
    expect(calculatePromotions({...input, founderProperties:1000})).toEqual(result);
  });
  it('returns unavailable break-even for zero attachment or nonpositive margin', () => {
    expect(calculatePromotions({...input, attachRate:0}).breakEvenProperties).toBeNull();
    expect(calculatePromotions({...input, variableCost:10}).breakEvenPurchases).toBeNull();
  });
  it('includes optional salary and taxes only positive modeled profit', () => {
    expect(calculatePromotions({...input, salaries:100}).breakEvenPurchases).toBe(67);
    expect(calculatePromotions({...input, taxRate:20}).tax).toBe(0);
    const result = calculatePromotions({...input, externalProperties:1000, taxRate:20});
    expect(result.tax).toBe(80);
    expect(result.afterTax).toBe(320);
  });
});

describe('capital allocation', () => {
  it('includes reserve once and calculates conditional released capacity', () => {
    expect(calculateBudget(initialBudget, 5000)).toEqual({allocated:10000, operatingAllocation:7000, reserve:3000, unallocated:0, overCap:0, releasedOperatingCap:5000, unreleased:2000});
  });
  it('limits operational release to capacity after protecting the reserve', () => {
    expect(calculateBudget(initialBudget,10000).releasedOperatingCap).toBe(7000);
    expect(calculateBudget(initialBudget,0).unreleased).toBe(7000);
  });
  it('shows overspending rather than hiding it', () => {
    const result = calculateBudget({...initialBudget, meta:2000}, 4000);
    expect(result.overCap).toBe(800);
    expect(result.unallocated).toBe(0);
    expect(result.releasedOperatingCap).toBe(4000);
  });
});
