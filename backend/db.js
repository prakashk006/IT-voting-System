const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const dbPath = path.join(__dirname, 'database.json');
const defaultState = {
  students: [],
  candidates: [],
  votes: [],
  settings: []
};

// --------------------------------------------------------------------------
// MONGODB CLIENT INITIALIZATION
// --------------------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI;
let mongoClient = null;
let mongoDb = null;

// Helper to escape special regex characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Helper to convert simple criteria filters to case-insensitive MongoDB queries
const buildMongoQuery = (criteria) => {
  const query = {};
  for (const [key, value] of Object.entries(criteria)) {
    if (typeof value === 'string') {
      query[key] = { $regex: new RegExp("^" + escapeRegExp(value) + "$", "i") };
    } else {
      query[key] = value;
    }
  }
  return query;
};

// --------------------------------------------------------------------------
// THREAD-SAFETY OPERATION QUEUE (Only used for local JSON Database fallback)
// --------------------------------------------------------------------------
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

const loadDb = () => {
  try {
    if (!fs.existsSync(dbPath)) {
      saveDb(defaultState);
      return defaultState;
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading database.json, resetting:', err);
    return defaultState;
  }
};

const saveDb = (data) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to database.json:', err);
  }
};

// --------------------------------------------------------------------------
// PUBLIC INTERFACE (Polymorphic JSON or MongoDB Driver)
// --------------------------------------------------------------------------
const initDb = async () => {
  if (MONGODB_URI) {
    try {
      mongoClient = new MongoClient(MONGODB_URI);
      await mongoClient.connect();
      
      // Parse database name from connection string or default to 'it_elections'
      const urlParts = MONGODB_URI.split('/');
      const dbName = urlParts[urlParts.length - 1].split('?')[0] || 'it_elections';
      mongoDb = mongoClient.db(dbName);
      
      console.log(`✅ Connected to cloud MongoDB database: "${dbName}"`);
    } catch (err) {
      console.error('❌ Failed to connect to cloud MongoDB. Crashing server:', err);
      process.exit(1);
    }
  } else {
    return enqueue(async () => {
      loadDb();
      console.log('📬 Connected to local Thread-safe JSON Database (database.json).');
    });
  }
};

const dbHelper = {
  initDb,

  // Get a single record
  get: async (table, criteria = {}) => {
    if (mongoDb) {
      const query = buildMongoQuery(criteria);
      return await mongoDb.collection(table).findOne(query);
    } else {
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
    }
  },

  // Get all records matching criteria
  all: async (table, criteria = {}) => {
    if (mongoDb) {
      const query = buildMongoQuery(criteria);
      return await mongoDb.collection(table).find(query).toArray();
    } else {
      return enqueue(async () => {
        const data = loadDb();
        const records = data[table] || [];
        if (Object.keys(criteria).length === 0) return records;
        
        return records.filter(item => {
          return Object.entries(criteria).every(([key, value]) => {
            if (typeof value === 'string' && typeof item[key] === 'string') {
              return item[key].toLowerCase() === value.toLowerCase();
            }
            return item[key] === value;
          });
        });
      });
    }
  },

  // Insert a record
  insert: async (table, record) => {
    if (mongoDb) {
      // Auto-increment simple integer IDs for candidates
      if (table === 'candidates' && !record.id) {
        const lastCand = await mongoDb.collection('candidates').find().sort({ id: -1 }).limit(1).toArray();
        record.id = lastCand.length > 0 ? (lastCand[0].id + 1) : 1;
      }
      
      await mongoDb.collection(table).insertOne(record);
      return record;
    } else {
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
    }
  },

  // Update records matching criteria
  update: async (table, criteria, updates) => {
    if (mongoDb) {
      const query = buildMongoQuery(criteria);
      const result = await mongoDb.collection(table).updateMany(query, { $set: updates });
      return { changes: result.modifiedCount };
    } else {
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
    }
  },

  // Delete records matching criteria
  delete: async (table, criteria) => {
    if (mongoDb) {
      const query = buildMongoQuery(criteria);
      const result = await mongoDb.collection(table).deleteMany(query);
      return { changes: result.deletedCount };
    } else {
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
    }
  },

  // Mock transaction functions to satisfy interfaces
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {}
};

module.exports = dbHelper;
