/**
 * Authentication storage module
 * Provides functionality for storing and retrieving authentication data using IndexedDB
 * Uses localStorage as a fallback when IndexedDB is unavailable or fails
 */

// Storage configuration
const DB_NAME = 'dumbkan-auth';
const DB_VERSION = 1;
const STORE_NAME = 'auth';
const LOCAL_STORAGE_KEY = 'dumbkan-auth-data';

/**
 * Detects if IndexedDB is available and properly functioning in the browser
 * @returns {Promise<boolean>} Whether IndexedDB is available
 */
export async function isIndexedDBAvailable() {
    return new Promise(resolve => {
        try {
            const testRequest = indexedDB.open('test-db');
            testRequest.onerror = () => resolve(false);
            testRequest.onsuccess = () => {
                testRequest.result.close();
                // Try to delete the test database
                try {
                    indexedDB.deleteDatabase('test-db');
                } catch (e) {
                    // Ignore delete errors
                }
                resolve(true);
            };
            // Resolve false after 1s timeout - indicates indexedDB is hanging
            setTimeout(() => resolve(false), 1000);
        } catch (e) {
            resolve(false);
        }
    });
}

/**
 * Initializes the IndexedDB database for authentication storage
 * @returns {Promise<IDBDatabase>} A promise that resolves to the opened database
 */
export async function initDB() {
    return new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            
            // Add a timeout to prevent hanging on initialization
            setTimeout(() => reject(new Error('IndexedDB open timeout')), 2000);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Stores authentication PIN with an expiration time
 * Falls back to localStorage if IndexedDB fails
 * @param {string} pin - The PIN to store
 * @returns {Promise<void>}
 */
export async function storeAuthData(pin) {
    const authData = {
        id: 'auth',
        pin,
        expires: Date.now() + (24 * 60 * 60 * 1000)
    };
    
    // First try to use IndexedDB
    if (await isIndexedDBAvailable()) {
        try {
            const db = await initDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            await store.put(authData);
            console.log('[Auth] PIN stored using IndexedDB');
            return;
        } catch (error) {
            console.warn('[Auth] Failed to store in IndexedDB, falling back to localStorage:', error);
        }
    }
    
    // Fallback to localStorage
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(authData));
        console.log('[Auth] PIN stored using localStorage fallback');
    } catch (error) {
        console.error('[Auth] Failed to store auth data in localStorage:', error);
    }
}

/**
 * Retrieves stored authentication data if not expired
 * Tries IndexedDB first, then falls back to localStorage
 * @returns {Promise<Object|null>} The stored auth data or null if expired/not found
 */
export async function getStoredAuth() {
    // First try to use IndexedDB
    if (await isIndexedDBAvailable()) {
        try {
            const db = await initDB();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            
            return new Promise((resolve, reject) => {
                const request = store.get('auth');
                
                request.onsuccess = () => {
                    const data = request.result;
                    if (data && data.expires > Date.now()) {
                        console.log('[Auth] Retrieved PIN from IndexedDB');
                        resolve(data);
                    } else {
                        // Clear expired data
                        try {
                            const deleteTx = db.transaction(STORE_NAME, 'readwrite');
                            const deleteStore = deleteTx.objectStore(STORE_NAME);
                            deleteStore.delete('auth');
                        } catch (e) {
                            // Ignore delete errors
                        }
                        resolve(null);
                    }
                };
                
                request.onerror = () => {
                    console.warn('[Auth] Error getting data from IndexedDB, trying localStorage');
                    reject(request.error);
                };
            });
        } catch (error) {
            console.warn('[Auth] Failed to get from IndexedDB, falling back to localStorage:', error);
        }
    } else {
        console.log('[Auth] IndexedDB not available, using localStorage');
    }
    
    // Fallback to localStorage
    try {
        const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedData) {
            const data = JSON.parse(storedData);
            if (data && data.expires > Date.now()) {
                console.log('[Auth] Retrieved PIN from localStorage');
                return data;
            } else {
                // Clear expired data
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        }
    } catch (error) {
        console.error('[Auth] Failed to get auth data from localStorage:', error);
    }
    
    return null;
}

// Make functions available on window for backward compatibility
if (typeof window !== 'undefined') {
    window.initDB = initDB;
    window.storeAuthData = storeAuthData;
    window.getStoredAuth = getStoredAuth;
    window.isIndexedDBAvailable = isIndexedDBAvailable;
} 