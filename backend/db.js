const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');

const defaultState = {
  students: [],
  candidates: [],
  votes: [],
  settings: []
};

// Thread-safety Operation Queue
// Since 400+ students might vote concurrently, we must process all reads/writes 
// sequentially in a queue. This prevents file locking conflicts and data corruption.
let dbQueue = Promise.resolve();

const enqueue = (operation) => {
  return new Promise((resolve, reject) => {
    dbQueue = dbQueue.then(async () => {
      try {
        const res = await operation();
        resolve(res);
      } catch (err) {
        reject(err);
      }
    });
  });
};

// Load database from file
const loadDb = () => {
  try {
    if (!fs.existsSync(dbPath)) {
      saveDb(defaultState);
      return defaultState;
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading database.json, resetting to empty state:', err);
    return defaultState;
  }
};

// Save database to file
const saveDb = (data) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to database.json:', err);
  }
};

const initDb = async () => {
  return enqueue(async () => {
    loadDb(); 
    console.log('Thread-safe JSON Database initialized successfully.');
  });
};

const dbHelper = {
  initDb,

  // Get a single record (Queue-safe)
  get: async (table, criteria = {}) => {
    return enqueue(async () => {
      const data = loadDb();
      const records = data[table] || [];
      
      return records.find(item => {
        return Object.entries(criteria).every(([key, value]) => {
          if (typeof value === 'string' && typeof item[key] === 'string') {
            return item[key].toLowerCase() === value.toLowerCase();
          }
          return item[key] === value;
        });
      });
    });
  },

  // Get all records matching criteria (Queue-safe)
  all: async (table, criteria = {}) => {
    return enqueue(async () => {
      const data = loadDb();
      const records = data[table] || [];

      if (Object.keys(criteria).length === 0) {
        return records;
      }

      return records.filter(item => {
        return Object.entries(criteria).every(([key, value]) => {
          if (typeof value === 'string' && typeof item[key] === 'string') {
            return item[key].toLowerCase() === value.toLowerCase();
          }
          return item[key] === value;
        });
      });
    });
  },

  // Insert a record (Queue-safe)
  insert: async (table, record) => {
    return enqueue(async () => {
      const data = loadDb();
      if (!data[table]) data[table] = [];

      if (table === 'candidates' || table === 'votes') {
        const maxId = data[table].reduce((max, item) => (item.id > max ? item.id : max), 0);
        record.id = maxId + 1;
      }

      data[table].push(record);
      saveDb(data);
      return record;
    });
  },

  // Update records matching criteria (Queue-safe)
  update: async (table, criteria, updates) => {
    return enqueue(async () => {
      const data = loadDb();
      const records = data[table] || [];
      let count = 0;

      const updatedRecords = records.map(item => {
        const match = Object.entries(criteria).every(([key, value]) => {
          if (typeof value === 'string' && typeof item[key] === 'string') {
            return item[key].toLowerCase() === value.toLowerCase();
          }
          return item[key] === value;
        });

        if (match) {
          count++;
          return { ...item, ...updates };
        }
        return item;
      });

      data[table] = updatedRecords;
      saveDb(data);
      return { changes: count };
    });
  },

  // Delete records matching criteria (Queue-safe)
  delete: async (table, criteria) => {
    return enqueue(async () => {
      const data = loadDb();
      const records = data[table] || [];
      let initialCount = records.length;

      const filtered = records.filter(item => {
        const match = Object.entries(criteria).every(([key, value]) => {
          return item[key] === value;
        });
        return !match;
      });

      data[table] = filtered;
      saveDb(data);
      return { changes: initialCount - filtered.length };
    });
  },

  // Transaction mocks
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {}
};

module.exports = dbHelper;
