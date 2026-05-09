// Client-side offline submission queue backed by IndexedDB.
// Used by the PWA provider to retry submissions when connectivity returns.

const DB_NAME = "docmanager-offline";
const STORE = "queue";

export type QueuedItem = {
  id: string;
  endpoint: string;
  payload: unknown;
  label: string;
  createdAt: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function enqueue(
  item: Omit<QueuedItem, "id" | "createdAt">,
): Promise<QueuedItem> {
  const db = await openDB();
  const full: QueuedItem = { id: newId(), createdAt: Date.now(), ...item };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(full);
    tx.oncomplete = () => resolve(full);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listQueued(): Promise<QueuedItem[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as QueuedItem[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeQueued(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function drainQueue(
  send: (item: QueuedItem) => Promise<boolean>,
): Promise<{ synced: number; failed: number }> {
  const items = await listQueued();
  let synced = 0;
  let failed = 0;
  for (const item of items) {
    let ok = false;
    try {
      ok = await send(item);
    } catch {
      ok = false;
    }
    if (ok) {
      try {
        await removeQueued(item.id);
        synced++;
      } catch {
        failed++;
      }
    } else {
      failed++;
    }
  }
  return { synced, failed };
}
