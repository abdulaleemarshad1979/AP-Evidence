const db = require('./database');
const { generateSyntheticData } = require('./synthetic_data');

async function seed() {
  await generateSyntheticData(db);
  console.log('[SEED COMPLETE] AP Spatio-Temporal Intelligence Platform seeded.');
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}

module.exports = seed;
