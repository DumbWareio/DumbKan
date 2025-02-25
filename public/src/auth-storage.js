/**
 * Authentication storage module
 * Provides functionality for storing and retrieving authentication data using IndexedDB
 * Used for PIN persistence across sessions
 */

// IndexedDB configuration
const DB_NAME = 'dumbkan-auth';
const DB_VERSION = 1;
const STORE_NAME = 'auth';

/**
 * Initializes the IndexedDB database for authentication storage
 * @returns {Promise<IDBDatabase>} A promise that resolves to the opened database
 */
export async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

/**
 * Stores authentication PIN with an expiration time
 * @param {string} pin - The PIN to store
 * @returns {Promise<void>}
 */
export async function storeAuthData(pin) {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        // Store PIN with expiration (24 hours)
        await store.put({
            id: 'auth',
            pin,
            expires: Date.now() + (24 * 60 * 60 * 1000)
        });
    } catch (error) {
        console.error('Failed to store auth data:', error);
    }
}

/**
 * Retrieves stored authentication data if not expired
 * @returns {Promise<Object|null>} The stored auth data or null if expired/not found
 */
export async function getStoredAuth() {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.get('auth');
            
            request.onsuccess = () => {
                const data = request.result;
                if (data && data.expires > Date.now()) {
                    resolve(data);
                } else {
                    // Clear expired data
                    const deleteTx = db.transaction(STORE_NAME, 'readwrite');
                    const deleteStore = deleteTx.objectStore(STORE_NAME);
                    deleteStore.delete('auth');
                    resolve(null);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to get stored auth:', error);
        return null;
    }
}

// Make functions available on window for backward compatibility
if (typeof window !== 'undefined') {
    window.initDB = initDB;
    window.storeAuthData = storeAuthData;
    window.getStoredAuth = getStoredAuth;
} 