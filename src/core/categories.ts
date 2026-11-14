import type { Category, CategoryId } from './types';

export const CATEGORIES: Category[] = [
  { id: 'sales', name: 'Sales Income', rule: 'Payments received from clients.' },
  { id: 'rent', name: 'Rent & Lease', rule: 'Studio or office rent.' },
  { id: 'software', name: 'Software & Subscriptions', rule: 'Apps and SaaS subscriptions (Adobe, etc.).' },
  { id: 'office', name: 'Office Supplies', rule: 'Paper, ink, small physical supplies.' },
  { id: 'meals', name: 'Meals', rule: 'Food and coffee with clients.' },
  { id: 'utilities', name: 'Utilities', rule: 'Internet, phone, electricity.' },
  { id: 'contract', name: 'Contract Labor', rule: 'Payments to freelancers and contractors.' },
  { id: 'car', name: 'Car & Truck', rule: 'Fuel, parking, tolls for business driving.' },
  { id: 'bankfees', name: 'Bank Fees', rule: 'Fees charged by the bank.' },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryName(id: CategoryId): string {
  return BY_ID.get(id)?.name ?? id;
}

export function isCategoryId(value: string): value is CategoryId {
  return BY_ID.has(value as CategoryId);
}
