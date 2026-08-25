const db = require('./database');

async function seed() {
  await db.init();

  const defaultUsers = [
    { id: 'USR-ADMIN', username: 'Admin', name: 'System Administrator', role: 'Admin', organization: 'ORG-ALPHA', jurisdiction: 'JUR-ALL', purposeClearance: 'SYSTEM_ADMINISTRATION' },
    { id: 'USR-USER', username: 'user', name: 'Standard User', role: 'Analyst', organization: 'ORG-ALPHA', jurisdiction: 'JUR-AP', purposeClearance: 'COUNTER_TERRORISM' },
    { id: 'USR-101', username: 'analyst_lead', name: 'Lead Investigator', role: 'Lead Investigator', organization: 'ORG-ALPHA', jurisdiction: 'JUR-UK', purposeClearance: 'COUNTER_TERRORISM' },
    { id: 'USR-102', username: 'case_manager', name: 'Case Manager', role: 'Case Manager', organization: 'ORG-ALPHA', jurisdiction: 'JUR-UK', purposeClearance: 'CASE_MANAGEMENT' },
    { id: 'USR-103', username: 'compliance_auditor', name: 'Compliance Auditor', role: 'Auditor', organization: 'ORG-ALPHA', jurisdiction: 'JUR-UK', purposeClearance: 'AUDIT' },
    { id: 'USR-104', username: 'sys_admin', name: 'System Admin', role: 'Admin', organization: 'ORG-ALPHA', jurisdiction: 'JUR-ALL', purposeClearance: 'SYSTEM_ADMINISTRATION' },
    { id: 'USR-105', username: 'unassigned_analyst', name: 'Unassigned Analyst', role: 'Field Analyst', organization: 'ORG-BETA', jurisdiction: 'JUR-US', purposeClearance: 'CYBER_INTEL' }
  ];

  for (const u of defaultUsers) {
    const existing = await db.getUserByUsername(u.username);
    if (!existing) {
      try {
        await db.execute(
          `INSERT INTO users (id, username, name, role, organization, jurisdiction, purpose_clearance)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [u.id, u.username, u.name, u.role, u.organization, u.jurisdiction, u.purposeClearance]
        );
      } catch (e) {
        // Ignored if user already exists
      }
    }
  }

  console.log('[SYSTEM INITIALIZED] AP Spatio-Temporal Intelligence Platform initialized with default user accounts.');
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(err => {
    console.error('Initialization error:', err);
    process.exit(1);
  });
}

module.exports = seed;

