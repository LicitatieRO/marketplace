/** All amounts are EUR; rates are percentages (1 means 1%). Illustrative, not market benchmarks. */
export type ChannelInput = { spend:number; cpm:number; ctr:number; inquiryRate:number; qualificationRate:number };
export type PromotionInput = { externalProperties:number; founderProperties:number; attachRate:number; netPrice:number; variableCost:number; overhead:number; salaries:number; taxRate:number };
export const examplePromotionDefaults: PromotionInput = {
  externalProperties: 8,
  founderProperties: 2,
  attachRate: 12,
  netPrice: 12,
  variableCost: 2,
  overhead: 800,
  salaries: 0,
  taxRate: 0,
};
export const channelPresets: Record<'conservative'|'base'|'optimistic', {meta:ChannelInput;tiktok:ChannelInput}> = {
  conservative:{meta:{spend:500,cpm:10,ctr:.7,inquiryRate:2.5,qualificationRate:28},tiktok:{spend:150,cpm:8,ctr:.6,inquiryRate:2,qualificationRate:22}},
  base:{meta:{spend:750,cpm:8,ctr:1,inquiryRate:4,qualificationRate:40},tiktok:{spend:200,cpm:6,ctr:.8,inquiryRate:3,qualificationRate:35}},
  optimistic:{meta:{spend:1000,cpm:6,ctr:1.2,inquiryRate:5,qualificationRate:48},tiktok:{spend:250,cpm:5,ctr:1,inquiryRate:4,qualificationRate:40}},
};
function nonnegative(value:number) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('Use finite, nonnegative values.');
  return value;
}
function percent(value:number) {
  nonnegative(value);
  if (value > 100) throw new RangeError('Percentages must be between 0 and 100.');
  return value / 100;
}
export function calculateChannel(input:ChannelInput) {
  const spend=nonnegative(input.spend), cpm=nonnegative(input.cpm);
  const ctr=percent(input.ctr), inquiryRate=percent(input.inquiryRate), qualificationRate=percent(input.qualificationRate);
  const impressions=cpm > 0 ? spend / cpm * 1000 : 0;
  const clicks=impressions * ctr, inquiries=clicks * inquiryRate, qualified=inquiries * qualificationRate;
  return { impressions, clicks, inquiries, qualified, cpqi:qualified > 0 ? spend / qualified : null };
}
export function calculatePromotions(input:PromotionInput) {
  Object.values(input).forEach(nonnegative);
  const attach=percent(input.attachRate), taxRate=percent(input.taxRate);
  const purchases=input.externalProperties * attach;
  const unitContribution=input.netPrice - input.variableCost;
  const revenue=purchases * input.netPrice, contribution=purchases * unitContribution;
  const fixedCosts=input.overhead + input.salaries;
  const beforeTax=contribution - fixedCosts;
  const tax=Math.max(0,beforeTax) * taxRate;
  const breakEvenPurchases=unitContribution > 0 ? Math.ceil(fixedCosts / unitContribution) : null;
  const breakEvenProperties=breakEvenPurchases !== null && attach > 0 ? Math.ceil(breakEvenPurchases / attach) : null;
  return { purchases, unitContribution, revenue, contribution, fixedCosts, beforeTax, tax, afterTax:beforeTax-tax, breakEvenPurchases, breakEvenProperties };
}
