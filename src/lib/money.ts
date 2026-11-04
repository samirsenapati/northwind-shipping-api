// Amounts travel as decimal strings ("6.85") and are computed in whole cents, so no total ever picks
// up floating-point drift.

export const formatCents = (cents: number): string => (cents / 100).toFixed(2);

export function toCents(amount: string): number {
  const [whole, fraction = ''] = amount.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
}
