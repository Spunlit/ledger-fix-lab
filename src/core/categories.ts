import type { Category, CategoryId, CategoryKind } from './types';

/** A small, tool-agnostic chart of accounts for a US sole proprietor. */
export const CATEGORIES: Category[] = [
  { id: 'sales', name: 'Sales income', kind: 'income', rule: 'Money customers paid for your work.' },
  { id: 'rent', name: 'Rent', kind: 'expense', rule: 'Studio, shop or office rent.' },
  { id: 'software', name: 'Software & subscriptions', kind: 'expense', rule: 'Apps and SaaS subscriptions.' },
  { id: 'office', name: 'Office supplies', kind: 'expense', rule: 'Paper, ink, small office items.' },
  { id: 'supplies', name: 'Job supplies', kind: 'expense', rule: 'Materials used to do the work for customers.' },
  { id: 'meals', name: 'Business meals', kind: 'expense', rule: 'Food and coffee with clients.' },
  { id: 'utilities', name: 'Phone & internet', kind: 'expense', rule: 'Phone, internet and similar services.' },
  { id: 'insurance', name: 'Insurance', kind: 'expense', rule: 'Business and vehicle insurance premiums.' },
  { id: 'contract', name: 'Contract labor', kind: 'expense', rule: 'Payments to freelancers and subcontractors.' },
  { id: 'car', name: 'Car & truck', kind: 'expense', rule: 'Fuel, parking, tolls for business driving.' },
  { id: 'bankfees', name: 'Bank fees', kind: 'expense', rule: 'Fees the bank charges the account.' },
  { id: 'ownerContribution', name: "Owner's contribution", kind: 'equity', rule: 'Owner moves personal money into the business. Not income.' },
  { id: 'ownerDraw', name: "Owner's draw", kind: 'equity', rule: 'Owner takes money out for personal use. Not an expense.' },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function category(id: CategoryId): Category {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Unknown category ${id}`);
  return c;
}

export function categoryName(id: CategoryId): string {
  return category(id).name;
}

export function categoryKind(id: CategoryId): CategoryKind {
  return category(id).kind;
}

export function isCategoryId(value: string): value is CategoryId {
  return BY_ID.has(value as CategoryId);
}
