// Define an interface for your data
interface SCAssetData {
    id: string;
    buffer: ArrayBuffer;
}

const DB_NAME = "titan-reactor";
const DB_VERSION = 2;

export type CacheDBStoreName = "general-casc-cache" | "image-cache";
export const cacheDBStoreNames = ["general-casc-cache", "image-cache"] as const;

export let appCacheDb: IDBDatabase;

let _cacheWasOpened = false;

export const initCacheDB = () =>
    new Promise((resolve, reject) => {
        const _timeout = setTimeout(() => {
            console.error("IndexedDB timeout");
            reject(new Error("IndexedDB timeout"));
        }, 1000);

        console.log("Opening IndexedDB");
        const dbReq = indexedDB.open(DB_NAME, DB_VERSION);

        dbReq.onblocked = () => {
            clearTimeout(_timeout);
            console.error("IndexedDB blocked");
            reject(new Error("IndexedDB blocked"));
        };

        // Create the schema
        dbReq.onupgradeneeded = () => {
            clearTimeout(_timeout);
            console.log("IndexedDB upgrade needed");
            appCacheDb = dbReq.result;
            for (const storeName of cacheDBStoreNames) {
                if (!appCacheDb.objectStoreNames.contains(storeName)) {
                    appCacheDb.createObjectStore(storeName, { keyPath: "id" });
                }
            }
            _cacheWasOpened = true;
            resolve(undefined);
        };

        // Error handler
        dbReq.onerror = (error) => {
            clearTimeout(_timeout);
            console.error(error);
            reject(error);
        };

        // Success handler
        dbReq.onsuccess = () => {
            clearTimeout(_timeout);
            console.log("IndexedDB opened successfully");
            appCacheDb = dbReq.result;
            _cacheWasOpened = true;
            resolve(undefined);
        };
    });

export class IndexedDBCache {
    #storeName: CacheDBStoreName;
    #enabled = _cacheWasOpened;

    constructor(storeName: CacheDBStoreName) {
        this.#storeName = storeName;
    }

    get enabled() {
        return this.#enabled;
    }

    set enabled(value: boolean) {
        if (_cacheWasOpened === false) {
            return;
        }
        if (value !== this.#enabled && value === false) {
            this.clear();
        }
        this.#enabled = value;
    }

    clear() {
        return new Promise((resolve, reject) => {
            let tx = appCacheDb.transaction(this.#storeName, "readwrite");
            let store = tx.objectStore(this.#storeName);
            let request = store.clear();
            request.onsuccess = resolve;
            request.onerror = reject;
        });
    }

    deleteValue(id: string) {
        return new Promise((resolve, reject) => {
            let tx = appCacheDb.transaction(this.#storeName, "readwrite");
            let store = tx.objectStore(this.#storeName);
            let request = store.delete(id);
            request.onsuccess = resolve;
            request.onerror = reject;
        });
    }

    setValue(value: SCAssetData) {
        if (!this.#enabled) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            let tx = appCacheDb.transaction(this.#storeName, "readwrite");
            let store = tx.objectStore(this.#storeName);
            let request = store.put(value);
            request.onsuccess = resolve;
            request.onerror = reject;
        });
    }

    getValue(id: string): Promise<Buffer | null> {
        if (!this.#enabled) {
            return Promise.resolve(null);
        }
        return new Promise((resolve) => {
            let tx = appCacheDb.transaction(this.#storeName, "readonly");
            let store = tx.objectStore(this.#storeName);
            let request = store.get(id);
            request.onsuccess = () => {
                if (request.result === undefined) {
                    resolve(null);
                } else {
                    resolve(Buffer.from(request.result.buffer));
                }
            };
            request.onerror = () => {
                console.error(request.error);
                resolve(null);
            };
        });
    }
}
