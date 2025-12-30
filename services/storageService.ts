import { ExamSession, MistakeRecord, QASession } from '../types';

const DB_NAME = 'AceMockDB';
const STORE_NAME = 'exam_history';
const MISTAKE_STORE_NAME = 'mistake_notebook';
const QA_STORE_NAME = 'qa_history';
const DB_VERSION = 3; // Bump version to 3

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // History Store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('endTime', 'endTime', { unique: false });
      }

      // Mistake Store
      if (!db.objectStoreNames.contains(MISTAKE_STORE_NAME)) {
        const mistakeStore = db.createObjectStore(MISTAKE_STORE_NAME, { keyPath: 'id' });
        mistakeStore.createIndex('questionText', 'question.questionText', { unique: false });
        mistakeStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // QA History Store
      if (!db.objectStoreNames.contains(QA_STORE_NAME)) {
        const qaStore = db.createObjectStore(QA_STORE_NAME, { keyPath: 'id' });
        qaStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }
    };
  });
};

// --- History Functions ---

export const saveExamSession = async (session: ExamSession): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(session);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllExamSessions = async (): Promise<ExamSession[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('endTime');
    const request = index.openCursor(null, 'prev'); // Sort by endTime desc
    const results: ExamSession[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteExamSession = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- Mistake Notebook Functions ---

export const saveMistake = async (record: Omit<MistakeRecord, 'id'>): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MISTAKE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(MISTAKE_STORE_NAME);
    const index = store.index('questionText');
    
    // Check for duplicates based on question text
    const checkRequest = index.get(record.question.questionText);

    checkRequest.onsuccess = () => {
      const existing = checkRequest.result;
      if (existing) {
        resolve();
      } else {
        const newRecord: MistakeRecord = {
            ...record,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5)
        };
        store.add(newRecord);
        resolve();
      }
    };
    
    checkRequest.onerror = () => reject(checkRequest.error);
  });
};

export const getAllMistakes = async (): Promise<MistakeRecord[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MISTAKE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(MISTAKE_STORE_NAME);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev'); // Newest first
      const results: MistakeRecord[] = [];
  
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
};

export const deleteMistake = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MISTAKE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(MISTAKE_STORE_NAME);
      const request = store.delete(id);
  
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
};

// --- QA History Functions ---

export const saveQASession = async (session: QASession): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(QA_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(QA_STORE_NAME);
    const request = store.put(session);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllQASessions = async (): Promise<QASession[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(QA_STORE_NAME, 'readonly');
    const store = transaction.objectStore(QA_STORE_NAME);
    const index = store.index('lastUpdated');
    const request = index.openCursor(null, 'prev');
    const results: QASession[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteQASession = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(QA_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(QA_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};