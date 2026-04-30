const cloud = require('wx-server-sdk');
const { getSeedData } = require('./seedData');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const collections = ['shops', 'rooms', 'merchants', 'users', 'orders', 'locks', 'history'];

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    const message = `${error && error.errMsg ? error.errMsg : ''} ${error && error.message ? error.message : ''}`;
    const alreadyExists = message.includes('already exists')
      || message.includes('ResourceExist')
      || message.includes('Table exist')
      || Number(error && error.errCode) === -501001;
    if (!alreadyExists) {
      throw error;
    }
  }
}

async function seedCollection(name, records) {
  const collection = db.collection(name);
  for (const record of records) {
    const existing = await collection.where({ id: record.id }).limit(1).get();
    if (!existing.data || !existing.data.length) {
      await collection.add({ data: record });
    }
  }
}

exports.main = async () => {
  const seed = getSeedData();
  for (const name of collections) {
    await ensureCollection(name);
    await seedCollection(name, seed[name] || []);
  }

  return {
    ok: true,
    collections
  };
};
