/// <reference types="vite/client" />

/** Optional host bridge (e.g. some desktop shells). */
interface Window {
  storage?: {
    get: (key: string) => Promise<{ value?: string } | null | undefined>;
    set: (key: string, value: string) => Promise<void>;
  };
}
