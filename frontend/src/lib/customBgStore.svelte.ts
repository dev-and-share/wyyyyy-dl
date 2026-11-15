export type CustomBgType = 'image' | 'video';
export type CustomBgFit = 'cover' | 'contain' | 'fill';

export interface CustomBgConfig {
  enabled: boolean;
  type: CustomBgType | null;
  name: string;
  dimOpacity: number;
  blur: number;
  scale: number;
  positionX: number;
  positionY: number;
  fit: CustomBgFit;
}

export interface CustomBgRecord {
  id: string;
  blob: Blob;
  type: CustomBgType;
  name: string;
  updatedAt: number;
}

const STORAGE_KEY = 'wyy_custom_bg_config';
const DB_NAME = 'wyy_player_custom_bg';
const DB_VERSION = 1;
const STORE_NAME = 'backgrounds';

const DEFAULT_CONFIG: CustomBgConfig = {
  enabled: true,
  type: null,
  name: '',
  dimOpacity: 0.35,
  blur: 0,
  scale: 1,
  positionX: 50,
  positionY: 50,
  fit: 'cover'
};

function safeCreateObjectURL(blob: Blob): string {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      return URL.createObjectURL(blob);
    } catch {}
  }
  return 'blob:custom-bg-mock-' + Date.now();
}

function safeRevokeObjectURL(url: string | null) {
  if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
}

let memoryRecord: CustomBgRecord | null = null;
let dbInstance: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined' || !indexedDB || typeof indexedDB.open !== 'function') {
    return Promise.resolve(null);
  }
  if (dbInstance) return Promise.resolve(dbInstance);

  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

  return new Promise((resolve) => {
    let settled = false;
    const timer = isTest
      ? setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve(null);
          }
        }, 150)
      : null;

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        try {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        } catch {}
      };
      request.onsuccess = () => {
        if (!settled) {
          settled = true;
          if (timer) clearTimeout(timer);
          dbInstance = request.result;
          resolve(request.result);
        }
      };
      request.onerror = () => {
        if (!settled) {
          settled = true;
          if (timer) clearTimeout(timer);
          resolve(null);
        }
      };
      request.onblocked = () => {
        if (!settled) {
          settled = true;
          if (timer) clearTimeout(timer);
          resolve(null);
        }
      };
    } catch {
      if (!settled) {
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

export async function idbSaveBackground(record: CustomBgRecord): Promise<boolean> {
  const db = await openDb();
  if (!db) {
    memoryRecord = record;
    return true;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        memoryRecord = record;
        resolve(true);
      };
    } catch {
      memoryRecord = record;
      resolve(true);
    }
  });
}

export async function idbGetBackground(id = 'current'): Promise<CustomBgRecord | null> {
  const db = await openDb();
  if (!db) return memoryRecord;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || memoryRecord || null);
      req.onerror = () => resolve(memoryRecord);
    } catch {
      resolve(memoryRecord);
    }
  });
}

export async function idbDeleteBackground(id = 'current'): Promise<boolean> {
  memoryRecord = null;
  const db = await openDb();
  if (!db) return true;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(true);
    } catch {
      resolve(true);
    }
  });
}

export function detectMediaType(file: { type?: string; name?: string }): CustomBgType {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv|ogg)$/i.test(name)) {
    return 'video';
  }
  return 'image';
}

export class CustomBgStore {
  url = $state<string | null>(null);
  type = $state<CustomBgType | null>(null);
  name = $state<string>('');
  dimOpacity = $state<number>(0.35);
  blur = $state<number>(0);
  scale = $state<number>(1);
  positionX = $state<number>(50);
  positionY = $state<number>(50);
  fit = $state<CustomBgFit>('cover');
  enabled = $state<boolean>(true);
  isLoaded = $state<boolean>(false);

  constructor() {
    this.loadFromStorage();
    if (typeof window !== 'undefined') {
      this.loadFromDb();
    }
  }

  private loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<CustomBgConfig>;
        if (typeof parsed.enabled === 'boolean') this.enabled = parsed.enabled;
        if (parsed.type === 'image' || parsed.type === 'video') this.type = parsed.type;
        if (typeof parsed.name === 'string') this.name = parsed.name;
        if (typeof parsed.dimOpacity === 'number') this.dimOpacity = parsed.dimOpacity;
        if (typeof parsed.blur === 'number') this.blur = parsed.blur;
        if (typeof parsed.scale === 'number') this.scale = parsed.scale;
        if (typeof parsed.positionX === 'number') this.positionX = parsed.positionX;
        if (typeof parsed.positionY === 'number') this.positionY = parsed.positionY;
        if (parsed.fit === 'cover' || parsed.fit === 'contain' || parsed.fit === 'fill') this.fit = parsed.fit;
      }
      const cachedData = localStorage.getItem('wyy_custom_bg_data');
      if (cachedData && this.type === 'image') {
        this.url = cachedData;
      }
    } catch {}
  }

  private saveConfig() {
    if (typeof localStorage === 'undefined') return;
    try {
      const config: CustomBgConfig = {
        enabled: this.enabled,
        type: this.type,
        name: this.name,
        dimOpacity: this.dimOpacity,
        blur: this.blur,
        scale: this.scale,
        positionX: this.positionX,
        positionY: this.positionY,
        fit: this.fit
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {}
  }

  async loadFromDb() {
    try {
      const record = await idbGetBackground('current');
      if (record && record.blob) {
        safeRevokeObjectURL(this.url);
        this.url = safeCreateObjectURL(record.blob);
        this.type = record.type;
        if (record.name) this.name = record.name;
      }
    } catch {
      // Graceful fallback
    } finally {
      this.isLoaded = true;
    }
  }

  async setMedia(file: File | Blob, type?: CustomBgType, name?: string) {
    const determinedType = type || detectMediaType(file);
    const fileName =
      name ||
      (file instanceof File ? file.name : determinedType === 'video' ? 'custom_video.mp4' : 'custom_photo.jpg');

    safeRevokeObjectURL(this.url);
    this.url = safeCreateObjectURL(file);
    this.type = determinedType;
    this.name = fileName;
    this.enabled = true;
    this.saveConfig();

    // 对于轻量图片 (≤ 2.5MB)，同步缓存 DataURL 到 localStorage 实现 0 毫秒首屏直出
    if (determinedType === 'image' && file.size < 2.5 * 1024 * 1024 && typeof FileReader !== 'undefined') {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            try {
              localStorage.setItem('wyy_custom_bg_data', reader.result);
            } catch {}
          }
        };
        reader.readAsDataURL(file);
      } catch {}
    }

    await idbSaveBackground({
      id: 'current',
      blob: file,
      type: determinedType,
      name: fileName,
      updatedAt: Date.now()
    });
  }

  async clear() {
    safeRevokeObjectURL(this.url);
    this.url = null;
    this.type = null;
    this.name = '';
    this.saveConfig();
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('wyy_custom_bg_data');
      } catch {}
    }
    await idbDeleteBackground('current');
  }

  setDimOpacity(opacity: number) {
    this.dimOpacity = Math.max(0, Math.min(0.9, opacity));
    this.saveConfig();
  }

  setBlur(blur: number) {
    this.blur = Math.max(0, Math.min(30, blur));
    this.saveConfig();
  }

  setScale(scale: number) {
    this.scale = Math.max(0.5, Math.min(2.5, Number(scale.toFixed(2))));
    this.saveConfig();
  }

  setPosition(x: number, y: number) {
    this.positionX = Math.max(0, Math.min(100, Math.round(x)));
    this.positionY = Math.max(0, Math.min(100, Math.round(y)));
    this.saveConfig();
  }

  setPositionX(x: number) {
    this.positionX = Math.max(0, Math.min(100, Math.round(x)));
    this.saveConfig();
  }

  setPositionY(y: number) {
    this.positionY = Math.max(0, Math.min(100, Math.round(y)));
    this.saveConfig();
  }

  setFit(fit: CustomBgFit) {
    this.fit = fit;
    this.saveConfig();
  }

  resetPositionAndScale() {
    this.scale = 1;
    this.positionX = 50;
    this.positionY = 50;
    this.fit = 'cover';
    this.saveConfig();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.saveConfig();
  }

  _reset() {
    safeRevokeObjectURL(this.url);
    this.url = null;
    this.type = null;
    this.name = '';
    this.dimOpacity = 0.35;
    this.blur = 0;
    this.scale = 1;
    this.positionX = 50;
    this.positionY = 50;
    this.fit = 'cover';
    this.enabled = true;
    this.isLoaded = false;
    memoryRecord = null;
    dbInstance = null;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('wyy_custom_bg_data');
      } catch {}
    }
  }
}

export const customBgStore = new CustomBgStore();
