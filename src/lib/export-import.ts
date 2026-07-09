import { db } from './db';

interface ExportData {
  version: number;
  exportDate: string;
  storeProfile: unknown[];
  products: unknown[];
  transactions: unknown[];
  pendingCarts: unknown[];
  settings: unknown[];
}

export async function exportAllData(): Promise<void> {
  const data: ExportData = {
    version: 1,
    exportDate: new Date().toISOString(),
    storeProfile: await db.storeProfile.toArray(),
    products: await db.products.toArray(),
    transactions: await db.transactions.toArray(),
    pendingCarts: await db.pendingCarts.toArray(),
    settings: await db.settings.toArray(),
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `kasir-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importAllData(file: File): Promise<{ success: boolean; message: string }> {
  try {
    const text = await file.text();
    const data: ExportData = JSON.parse(text);

    if (!data.version || !data.exportDate) {
      return { success: false, message: 'Format file tidak valid. Pastikan file berasal dari export Kasir.' };
    }

    // Clear existing data
    await db.storeProfile.clear();
    await db.products.clear();
    await db.transactions.clear();
    await db.pendingCarts.clear();
    await db.settings.clear();

    // Import data
    if (data.storeProfile?.length) {
      await db.storeProfile.bulkPut(data.storeProfile as never[]);
    }
    if (data.products?.length) {
      await db.products.bulkPut(data.products as never[]);
    }
    if (data.transactions?.length) {
      // Restore Date objects
      const txs = (data.transactions as { timestamp: string }[]).map(t => ({
        ...t,
        timestamp: new Date(t.timestamp),
      }));
      await db.transactions.bulkPut(txs as never[]);
    }
    if (data.pendingCarts?.length) {
      const carts = (data.pendingCarts as { timestamp: string }[]).map(c => ({
        ...c,
        timestamp: new Date(c.timestamp),
      }));
      await db.pendingCarts.bulkPut(carts as never[]);
    }
    if (data.settings?.length) {
      await db.settings.bulkPut(data.settings as never[]);
    }

    return { success: true, message: 'Data berhasil diimpor!' };
  } catch {
    return { success: false, message: 'Gagal mengimpor data. Pastikan file JSON valid.' };
  }
}
