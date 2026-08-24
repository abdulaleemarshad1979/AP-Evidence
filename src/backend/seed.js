const db = require('./database');
const { generateSyntheticData } = require('./synthetic_data');

function seed() {
  generateSyntheticData();
  console.log('[SEED COMPLETE] AP Spatio-Temporal Intelligence Platform seeded.');
}

if (require.main === module) {
  seed();
}

module.exports = seed;
