/**
 * Small IndexedDB layer with versioned migrations and transactional writes.
 * Only settings, lesson evidence and practice summaries are stored — never audio.
 */
import { DEFAULT_SETTINGS, type AssetRecord, type LessonProgress, type PracticeSummaryRecord, type Settings, type SongRecord } from './types';
import type { Score } from '../domain/score';

export const DB_NAME = 'guitar-unhero';
export const DB_VERSION = 2;

type StoreName = 'settings' | 'lessons' | 'summaries' | 'songs' | 'arrangements' | 'assets';

let dbPromise: Promise<IDBDatabase> | null = null;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

export function openDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const r = factory.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = (ev) => {
      const db = r.result;
      const from = ev.oldVersion;
      // Migration 0 → 1: initial stores.
      if (from < 1) {
        db.createObjectStore('settings');
        db.createObjectStore('lessons', { keyPath: 'lessonId' });
        const s = db.createObjectStore('summaries', { keyPath: 'id' });
        s.createIndex('finishedAt', 'finishedAt');
      }
      // Migration 1 → 2: song workspace (M3). Large audio blobs live apart from metadata.
      if (from < 2) {
        db.createObjectStore('songs', { keyPath: 'id' });
        db.createObjectStore('arrangements', { keyPath: 'key' });
        db.createObjectStore('assets', { keyPath: 'id' });
      }
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Database upgrade blocked by another open tab'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

/** For tests: forget the cached connection. */
export async function closeDb(): Promise<void> {
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      /* ignore */
    }
  }
  dbPromise = null;
}

export async function loadSettings(): Promise<Settings> {
  const db = await openDb();
  const s = (await req(db.transaction('settings').objectStore('settings').get('settings'))) as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('settings', 'readwrite');
  tx.objectStore('settings').put(s, 'settings');
  await done(tx);
}

export async function loadLessons(): Promise<LessonProgress[]> {
  const db = await openDb();
  return (await req(db.transaction('lessons').objectStore('lessons').getAll())) as LessonProgress[];
}

export async function saveLesson(p: LessonProgress): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('lessons', 'readwrite');
  tx.objectStore('lessons').put(p);
  await done(tx);
}

export async function loadSummaries(): Promise<PracticeSummaryRecord[]> {
  const db = await openDb();
  const all = (await req(db.transaction('summaries').objectStore('summaries').getAll())) as PracticeSummaryRecord[];
  return all.sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1));
}

export async function saveSummary(s: PracticeSummaryRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('summaries', 'readwrite');
  tx.objectStore('summaries').put(s);
  await done(tx);
}

export async function clearStores(stores: StoreName[]): Promise<void> {
  if (!stores.length) return;
  const db = await openDb();
  const tx = db.transaction(stores, 'readwrite');
  stores.forEach((n) => tx.objectStore(n).clear());
  await done(tx);
}

/** Replace all local data atomically (used by import). */
export async function replaceAll(settings: Settings, lessons: LessonProgress[], summaries: PracticeSummaryRecord[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['settings', 'lessons', 'summaries'], 'readwrite');
  tx.objectStore('settings').clear();
  tx.objectStore('lessons').clear();
  tx.objectStore('summaries').clear();
  tx.objectStore('settings').put(settings, 'settings');
  lessons.forEach((l) => tx.objectStore('lessons').put(l));
  summaries.forEach((s) => tx.objectStore('summaries').put(s));
  await done(tx);
}

// ---------------- song workspace (M3) ----------------
export async function loadSongs(): Promise<SongRecord[]> {
  const db = await openDb();
  const all = (await req(db.transaction('songs').objectStore('songs').getAll())) as SongRecord[];
  return all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function saveSong(s: SongRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('songs', 'readwrite');
  tx.objectStore('songs').put(s);
  await done(tx);
}

/** Arrangement versions are immutable: a key is `${arrangementId}@${version}`. */
export async function saveArrangement(score: Score): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('arrangements', 'readwrite');
  tx.objectStore('arrangements').put({ key: `${score.arrangementId}@${score.version}`, score });
  await done(tx);
}

export async function loadArrangement(arrangementId: string, version: number): Promise<Score | null> {
  const db = await openDb();
  const r = (await req(db.transaction('arrangements').objectStore('arrangements').get(`${arrangementId}@${version}`))) as { score: Score } | undefined;
  return r?.score ?? null;
}

export async function saveAsset(a: AssetRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('assets', 'readwrite');
  tx.objectStore('assets').put(a);
  await done(tx);
}

export async function loadAsset(id: string): Promise<AssetRecord | null> {
  const db = await openDb();
  return ((await req(db.transaction('assets').objectStore('assets').get(id))) as AssetRecord | undefined) ?? null;
}

/** Delete a song, its arrangement versions and its audio. */
export async function deleteSong(song: SongRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['songs', 'arrangements', 'assets'], 'readwrite');
  tx.objectStore('songs').delete(song.id);
  for (const v of song.versions) tx.objectStore('arrangements').delete(`${v.arrangementId}@${v.version}`);
  if (song.assetId) tx.objectStore('assets').delete(song.assetId);
  await done(tx);
}
