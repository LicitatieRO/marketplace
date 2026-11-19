import type { Metadata } from 'next';
import { FounderCalculator } from '@/components/founder-calculator';

export const metadata: Metadata = {title:'Plan & calculator',description:'Illustrative LicitatieRO launch plan and editable financial assumptions. No investment or profitability promise.'};
export default function FounderPage() { return <FounderCalculator/>; }
