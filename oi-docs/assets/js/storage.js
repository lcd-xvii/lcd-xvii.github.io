const idb = (() => {
  let databasePromise = null;

  function open() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('oi-docs', 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('docs')) database.createObjectStore('docs');
        if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return databasePromise;
  }

  async function get(store, key) {
    try {
      const database = await open();
      return await new Promise((resolve, reject) => {
        const request = database.transaction(store, 'readonly').objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('[OI 文档] 读取本地缓存失败', error);
      return null;
    }
  }

  async function set(store, key, value) {
    try {
      const database = await open();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(store, 'readwrite');
        transaction.objectStore(store).put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.warn('[OI 文档] 写入本地缓存失败', error);
    }
  }

  async function clear(store) {
    try {
      const database = await open();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(store, 'readwrite');
        transaction.objectStore(store).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.warn('[OI 文档] 清理本地缓存失败', error);
      throw error;
    }
  }

  return { get, set, clear };
})();

export default idb;
