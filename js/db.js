const DB_NAME = 'fbb-workout-log';
const DB_VERSION = 1;
const STORE_NAME = 'workouts';

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'date' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

function tx(mode) {
  return openDB().then((db) => {
    const transaction = db.transaction(STORE_NAME, mode);
    return transaction.objectStore(STORE_NAME);
  });
}

export async function getWorkout(date) {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(date);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveWorkout(workout) {
  workout.updatedAt = Date.now();
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(workout);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteWorkout(date) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(date);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllWorkouts() {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result || [];
      results.sort((a, b) => b.date.localeCompare(a.date));
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getWorkoutsInRange(startDate, endDate) {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const range = IDBKeyRange.bound(startDate, endDate);
    const request = store.getAll(range);
    request.onsuccess = () => {
      const results = request.result || [];
      results.sort((a, b) => a.date.localeCompare(b.date));
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getWorkoutDates() {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const dates = [];
    const request = store.openKeyCursor();
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        dates.push(cursor.key);
        cursor.continue();
      } else {
        resolve(dates);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
