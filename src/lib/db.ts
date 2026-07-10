import Dexie, { type EntityTable } from 'dexie';

// === Type Definitions ===

export interface StoreProfile {
  id: number;
  storeName: string;
  address: string;
  socialMedia: string;
  logo: string; // Base64
  qrisImage: string; // Base64
}

export interface Product {
  id?: number;
  name: string;
  sku: string;
  stock: number;
  buyPrice: number;
  sellPrice: number;
  photo: string; // Base64
  category: string;
  notes: string;
  createdAt: Date;
}

export interface TransactionItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
  buyPrice: number;
}

export interface Transaction {
  id?: number;
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  total: number;
  paymentMethod: 'cash' | 'qris';
  cashReceived?: number;
  change?: number;
  status: 'completed' | 'voided';
  timestamp: Date;
  customerName?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface PendingCart {
  id?: number;
  items: CartItem[];
  label: string;
  timestamp: Date;
}

export interface Setting {
  key: string;
  value: unknown;
}

// === Database Class ===

class KasirDatabase extends Dexie {
  storeProfile!: EntityTable<StoreProfile, 'id'>;
  products!: EntityTable<Product, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  pendingCarts!: EntityTable<PendingCart, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor() {
    super('KasirOfflineDB');

    this.version(1).stores({
      storeProfile: 'id',
      products: '++id, name, sku, category, stock',
      transactions: '++id, status, timestamp, paymentMethod',
      pendingCarts: '++id, label, timestamp',
      settings: 'key',
    });
  }
}

export const db = new KasirDatabase();

// === Helper Functions ===

export async function getStoreProfile(): Promise<StoreProfile | undefined> {
  return db.storeProfile.get(1);
}

export async function saveStoreProfile(profile: Partial<StoreProfile>): Promise<void> {
  await db.storeProfile.put({ id: 1, storeName: '', address: '', socialMedia: '', logo: '', qrisImage: '', ...profile } as StoreProfile);
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const setting = await db.settings.get(key);
  return setting ? (setting.value as T) : defaultValue;
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export async function getLowStockProducts(threshold: number = 5): Promise<Product[]> {
  return db.products.where('stock').belowOrEqual(threshold).toArray();
}

export async function getCategories(): Promise<string[]> {
  const products = await db.products.toArray();
  const cats = new Set(products.map(p => p.category).filter(Boolean));
  const defaults = ['Makanan', 'Minuman', 'Snack', 'Lainnya'];
  defaults.forEach(c => cats.add(c));
  return Array.from(cats).sort();
}

export async function getTodayTransactions(): Promise<Transaction[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return db.transactions
    .where('timestamp')
    .aboveOrEqual(today)
    .toArray();
}
