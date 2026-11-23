import { describe, expect, it } from 'vitest';
import {
  calculateChannel,
  calculatePromotions,
  channelPresets,
  examplePromotionDefaults,
} from '../../src/lib/economics';

describe('media funnel', () => {
  it('calculates Meta base spend through qualified inquiries without rounding the funnel', () => {
    expect(calculateChannel(channelPresets.base.meta)).toEqual({
      impressions: 93750,
      clicks: 937.5,
      inquiries: 37.5,
      qualified: 15,
      cpqi: 50,
    });
  });
  it('preserves fractional TikTok expectations', () => {
    const result = calculateChannel(channelPresets.base.tiktok);
    expect(result.qualified).toBeCloseTo(2.8);
    expect(result.cpqi).toBeCloseTo(71.428571);
  });
  it('handles zero CPM and zero conversion without Infinity or misleading zero cost', () => {
    expect(calculateChannel({ spend: 100, cpm: 0, ctr: 1, inquiryRate: 4, qualificationRate: 40 })).toEqual({
      impressions: 0,
      clicks: 0,
      inquiries: 0,
      qualified: 0,
      cpqi: null,
    });
    expect(calculateChannel({ ...channelPresets.base.meta, ctr: 0 }).cpqi).toBeNull();
  });
  it('rejects invalid rates and nonfinite money', () => {
    expect(() => calculateChannel({ ...channelPresets.base.meta, ctr: 101 })).toThrow();
    expect(() => calculateChannel({ ...channelPresets.base.meta, spend: NaN })).toThrow();
    expect(() => calculateChannel({ ...channelPresets.base.meta, spend: -1 })).toThrow();
  });
});

describe('physical-property promotions', () => {
  it('excludes founder properties and charges once per physical property for seven days', () => {
    const result = calculatePromotions(examplePromotionDefaults);
    expect(result.purchases).toBeCloseTo(0.96);
    expect(result.contribution).toBeCloseTo(9.6);
    expect(result.breakEvenPurchases).toBe(80);
    expect(result.breakEvenProperties).toBe(667);
    expect(calculatePromotions({ ...examplePromotionDefaults, founderProperties: 1000 })).toEqual(result);
  });
  it('returns unavailable break-even for zero attachment or nonpositive margin', () => {
    expect(calculatePromotions({ ...examplePromotionDefaults, attachRate: 0 }).breakEvenProperties).toBeNull();
    expect(calculatePromotions({ ...examplePromotionDefaults, variableCost: 12 }).breakEvenPurchases).toBeNull();
  });
  it('includes optional salary and taxes only positive modeled profit', () => {
    expect(calculatePromotions({ ...examplePromotionDefaults, salaries: 100 }).breakEvenPurchases).toBe(90);
    expect(calculatePromotions({ ...examplePromotionDefaults, taxRate: 20 }).tax).toBe(0);
    const result = calculatePromotions({ ...examplePromotionDefaults, externalProperties: 1000, taxRate: 20 });
    expect(result.tax).toBe(80);
    expect(result.afterTax).toBe(320);
  });
});
