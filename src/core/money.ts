// Formatting only. All arithmetic elsewhere stays in integer cents.

const MINUS = '−';

function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) throw new Error(`Money must be integer cents, got ${cents}`);
}

function absDollars(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  const rest = String(abs % 100).padStart(2, '0');
  return `$${dollars}.${rest}`;
}

/** 41250 -> "$412.50", -41250 -> "−$412.50". */
export function formatCents(cents: number): string {
  assertCents(cents);
  return cents < 0 ? `${MINUS}${absDollars(cents)}` : absDollars(cents);
}

/** Like formatCents but positive values get an explicit "+". Zero is "$0.00". */
export function formatSignedCents(cents: number): string {
  assertCents(cents);
  if (cents > 0) return `+${absDollars(cents)}`;
  return formatCents(cents);
}

export function sumCents(values: number[]): number {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
  }
  assertCents(total);
  return total;
}
