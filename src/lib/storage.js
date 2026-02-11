

const StoreChatDB = {
    DB_NAME: 'StoreChat',
    DB_VERSION: 1,
    _db: null,


    async open() {
        if (this._db) return this._db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;


                if (!db.objectStoreNames.contains('conversations')) {
                    const store = db.createObjectStore('conversations', { keyPath: 'id' });
                    store.createIndex('platform', 'platform', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('syncStatus', 'syncStatus', { unique: false });
                    store.createIndex('contentHash', 'contentHash', { unique: false });
                }


                if (!db.objectStoreNames.contains('syncQueue')) {
                    const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
                    syncStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this._db = event.target.result;
                resolve(this._db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    },


    async save(metadata, compressedData) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['conversations', 'syncQueue'], 'readwrite');

            const record = {
                id: metadata.id,
                platform: metadata.platform,
                title: metadata.title || 'Untitled',
                timestamp: metadata.timestamp || new Date().toISOString(),
                turnCount: metadata.turnCount || 0,
                contentHash: metadata.contentHash || '',
                url: metadata.url || '',
                compressedData: compressedData,
                compressedSize: compressedData.byteLength,
                syncStatus: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            tx.objectStore('conversations').put(record);
            tx.objectStore('syncQueue').put({
                id: metadata.id,
                createdAt: new Date().toISOString()
            });

            tx.oncomplete = () => resolve(record);
            tx.onerror = (event) => reject(event.target.error);
        });
    },


    async getAll(options = {}) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('conversations', 'readonly');
            const store = tx.objectStore('conversations');
            const results = [];

            let request;
            if (options.platform) {
                const index = store.index('platform');
                request = index.openCursor(IDBKeyRange.only(options.platform));
            } else {
                const index = store.index('timestamp');
                request = index.openCursor(null, 'prev');
            }

            let count = 0;
            const limit = options.limit || Infinity;
            const offset = options.offset || 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && count < limit + offset) {
                    if (count >= offset) {

                        const { compressedData, ...meta } = cursor.value;
                        results.push(meta);
                    }
                    count++;
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = (event) => reject(event.target.error);
        });
    },


    async get(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('conversations', 'readonly');
            const request = tx.objectStore('conversations').get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = (event) => reject(event.target.error);
        });
    },


    async getUnsyncedIds() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('syncQueue', 'readonly');
            const store = tx.objectStore('syncQueue');
            const ids = [];

            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    ids.push(cursor.value.id);
                    cursor.continue();
                } else {
                    resolve(ids);
                }
            };
            request.onerror = (event) => reject(event.target.error);
        });
    },


    async markSynced(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['conversations', 'syncQueue'], 'readwrite');


            const convStore = tx.objectStore('conversations');
            const getReq = convStore.get(id);
            getReq.onsuccess = () => {
                const record = getReq.result;
                if (record) {
                    record.syncStatus = 'synced';
                    record.updatedAt = new Date().toISOString();
                    convStore.put(record);
                }
            };


            tx.objectStore('syncQueue').delete(id);

            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject(event.target.error);
        });
    },


    async delete(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['conversations', 'syncQueue'], 'readwrite');
            tx.objectStore('conversations').delete(id);
            tx.objectStore('syncQueue').delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject(event.target.error);
        });
    },


    async getStats() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['conversations', 'syncQueue'], 'readonly');

            const stats = {
                totalConversations: 0,
                totalSize: 0,
                platformCounts: {},
                unsyncedCount: 0
            };


            const convStore = tx.objectStore('conversations');
            const convCursor = convStore.openCursor();
            convCursor.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    stats.totalConversations++;
                    stats.totalSize += cursor.value.compressedSize || 0;
                    const platform = cursor.value.platform;
                    stats.platformCounts[platform] = (stats.platformCounts[platform] || 0) + 1;
                    cursor.continue();
                }
            };


            const syncStore = tx.objectStore('syncQueue');
            const countReq = syncStore.count();
            countReq.onsuccess = () => {
                stats.unsyncedCount = countReq.result;
            };

            tx.oncomplete = () => resolve(stats);
            tx.onerror = (event) => reject(event.target.error);
        });
    },


    async isDuplicate(hash) {
        if (!hash) return false;
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('conversations', 'readonly');
            const index = tx.objectStore('conversations').index('contentHash');
            const request = index.get(hash);
            request.onsuccess = () => resolve(!!request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    },


    async cleanupOld(days = 30) {
        const db = await this.open();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffISO = cutoff.toISOString();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(['conversations', 'syncQueue'], 'readwrite');
            const store = tx.objectStore('conversations');
            const cursor = store.openCursor();
            let deleted = 0;

            cursor.onsuccess = (event) => {
                const c = event.target.result;
                if (c) {
                    const rec = c.value;

                    if (rec.syncStatus === 'synced' && rec.timestamp < cutoffISO) {
                        store.delete(rec.id);
                        tx.objectStore('syncQueue').delete(rec.id);
                        deleted++;
                    }
                    c.continue();
                }
            };

            tx.oncomplete = () => resolve(deleted);
            tx.onerror = (event) => reject(event.target.error);
        });
    },


    async clearAll() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['conversations', 'syncQueue'], 'readwrite');
            tx.objectStore('conversations').clear();
            tx.objectStore('syncQueue').clear();
            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject(event.target.error);
        });
    }
};

if (typeof globalThis !== 'undefined') {
    globalThis.StoreChatDB = StoreChatDB;
}
