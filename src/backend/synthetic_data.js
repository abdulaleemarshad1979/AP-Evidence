const db = require('./database');
const crypto = require('crypto');

function generateSyntheticData() {
  console.log('[SYNTHETIC ENGINE] Generating multi-source intelligence dataset...');

  // 1. Users
  db.users = [
    { id: 'USR-101', username: 'analyst_lead', name: 'Dr. Sarah Vance', role: 'Analyst', clearance: 'TOP_SECRET_SCI', department: 'Counter-Terrorism & Threat Intel' },
    { id: 'USR-102', username: 'case_manager', name: 'Marcus Brody', role: 'Case Manager', clearance: 'TOP_SECRET', department: 'Special Operations Group' },
    { id: 'USR-103', username: 'compliance_auditor', name: 'Elena Vance', role: 'Auditor', clearance: 'SECRET', department: 'IG Oversight & Audit' },
    { id: 'USR-104', username: 'sys_admin', name: 'Root Operations', role: 'Admin', clearance: 'TOP_SECRET_SCI', department: 'Cyber & Platform Admin' }
  ];

  // 2. Entities
  db.entities = [
    {
      id: 'PER-88219',
      type: 'Person',
      name: 'Viktor Vance',
      aliases: ['The Architect', 'Viktor V.'],
      dob: '1981-04-12',
      nationality: 'Dual (UK / CY)',
      passportNo: 'GB-99201488',
      primaryPhone: '+44-7700-900412',
      phoneNumbers: ['+44-7700-900412', '+41-79-555-0192'],
      riskScore: 94,
      classification: 'TOP_SECRET_SCI',
      primaryLocation: 'London, UK / Zurich, CH',
      notes: 'High-value target associated with illicit cyber-financial transactions and cross-border logistics.'
    },
    {
      id: 'PER-88220',
      type: 'Person',
      name: 'Elena Rostova',
      aliases: ['Helen Rostov', 'E. Rostova'],
      dob: '1987-09-24',
      nationality: 'Estonia',
      passportNo: 'EE-44910293',
      primaryPhone: '+372-555-0149',
      phoneNumbers: ['+372-555-0149', '+44-7700-900881'],
      riskScore: 88,
      classification: 'TOP_SECRET',
      primaryLocation: 'Tallinn, EE / London, UK',
      notes: 'Financial conduit and shell company controller linked to Viktor Vance.'
    },
    {
      id: 'PER-88221',
      type: 'Person',
      name: 'Tariq Al-Mansoor',
      aliases: ['Abu Omar', 'Tariq M.'],
      dob: '1979-11-03',
      nationality: 'UAE',
      passportNo: 'AE-77109283',
      primaryPhone: '+971-50-123-4567',
      phoneNumbers: ['+971-50-123-4567'],
      riskScore: 91,
      classification: 'TOP_SECRET',
      primaryLocation: 'Dubai, UAE',
      notes: 'Regional logistics broker and encrypted communications provider.'
    },
    {
      id: 'PER-88222',
      type: 'Person',
      name: 'V. Vance (Unverified Alias)',
      aliases: ['V. Vance', 'Viktor V.'],
      dob: '1981-04-12',
      nationality: 'UK',
      passportNo: 'GB-99201488',
      primaryPhone: '+44-7700-900412',
      phoneNumbers: ['+44-7700-900412'],
      riskScore: 78,
      classification: 'SECRET',
      primaryLocation: 'London, UK',
      notes: 'Automated entity extract from Heathrow LPR / Passport Scan.'
    },
    {
      id: 'VEH-901',
      type: 'Vehicle',
      name: 'Black Armored SUV (Bentley Bentayga)',
      licensePlate: 'KX71-FZX',
      vin: 'SJAAC2ZY9MC019283',
      make: 'Bentley',
      model: 'Bentayga',
      color: 'Obsidian Black',
      registeredOwner: 'PER-88219',
      riskScore: 82,
      classification: 'SECRET'
    },
    {
      id: 'VEH-902',
      type: 'Vehicle',
      name: 'Silver Mercedes-AMG G63',
      licensePlate: 'LX69-WYZ',
      vin: 'W1N4632761X091823',
      make: 'Mercedes-Benz',
      model: 'G63 AMG',
      color: 'Iridium Silver',
      registeredOwner: 'PER-88220',
      riskScore: 75,
      classification: 'SECRET'
    },
    {
      id: 'TEL-4412',
      type: 'Telecom',
      name: 'Encrypted Bearer Line (+44-7700-900412)',
      msisdn: '+44-7700-900412',
      imsi: '234159012345678',
      imei: '358910091234560',
      carrier: 'GlobalSecure Mobile',
      riskScore: 90,
      classification: 'TOP_SECRET'
    },
    {
      id: 'FIN-3391',
      type: 'FinancialAccount',
      name: 'Zurich Offshore Private Banking #88192',
      accountNumber: 'CH93-0024-8819-2091-8',
      bankName: 'Helvetia Private Vault CH',
      accountHolder: 'PER-88219',
      riskScore: 95,
      classification: 'TOP_SECRET_SCI'
    },
    {
      id: 'LOC-501',
      type: 'Location',
      name: 'Mayfair Safehouse Complex',
      address: '14 Curzon Street, Mayfair, London W1J 5HN',
      latitude: 51.5074,
      longitude: -0.1478,
      facilityType: 'Safehouse',
      riskScore: 89,
      classification: 'SECRET'
    },
    {
      id: 'LOC-502',
      type: 'Location',
      name: 'Zurich Financial Hub Office',
      address: 'Gotthardstrasse 26, 8002 Zürich, Switzerland',
      latitude: 47.3667,
      longitude: 8.5333,
      facilityType: 'Corporate Office',
      riskScore: 70,
      classification: 'SECRET'
    },
    {
      id: 'LOC-503',
      type: 'Location',
      name: 'Dubai Marina Luxury Tower',
      address: 'Marina Gate 1, Dubai Marina, UAE',
      latitude: 25.0805,
      longitude: 55.1403,
      facilityType: 'Residence',
      riskScore: 85,
      classification: 'SECRET'
    }
  ];

  // 3. Cases
  db.cases = [
    {
      id: 'CASE-2026-091',
      title: 'Operation BLACKSTONE',
      codeName: 'OPERATION_BLACKSTONE',
      description: 'Cross-border spatio-temporal tracking of cyber-financial network operating across London, Zurich, and Dubai.',
      classification: 'TOP_SECRET_SCI',
      threatLevel: 'CRITICAL',
      status: 'ACTIVE',
      assignedAnalysts: ['Dr. Sarah Vance', 'Marcus Brody'],
      targetEntityIds: ['PER-88219', 'PER-88220', 'PER-88221', 'FIN-3391', 'VEH-901'],
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'CASE-2026-044',
      title: 'Operation CYBER_FOX',
      codeName: 'OPERATION_CYBER_FOX',
      description: 'Encrypted communications network mapping & cell tower hop trajectory analysis.',
      classification: 'SECRET',
      threatLevel: 'HIGH',
      status: 'ACTIVE',
      assignedAnalysts: ['Dr. Sarah Vance'],
      targetEntityIds: ['PER-88221', 'TEL-4412'],
      createdAt: '2026-07-15T10:30:00Z',
      updatedAt: new Date().toISOString()
    }
  ];

  // 4. Relationships
  db.relationships = [
    { id: 'REL-101', source: 'PER-88219', target: 'PER-88220', type: 'CO_TRAVELER_ASSOCIATE', confidence: 0.96, evidenceRef: 'EVD-9001' },
    { id: 'REL-102', source: 'PER-88219', target: 'PER-88221', type: 'ENCRYPTED_CALL_COMMUNICATION', confidence: 0.91, evidenceRef: 'EVD-9002' },
    { id: 'REL-103', source: 'PER-88219', target: 'VEH-901', type: 'OWNS_OPERATES', confidence: 0.99, evidenceRef: 'EVD-9003' },
    { id: 'REL-104', source: 'PER-88220', target: 'VEH-902', type: 'REGISTERED_OWNER', confidence: 0.98, evidenceRef: 'EVD-9004' },
    { id: 'REL-105', source: 'PER-88219', target: 'FIN-3391', type: 'BENEFICIAL_OWNER', confidence: 0.97, evidenceRef: 'EVD-9005' },
    { id: 'REL-106', source: 'PER-88219', target: 'LOC-501', type: 'FREQUENTS_SAFEHOUSE', confidence: 0.94, evidenceRef: 'EVD-9006' },
    { id: 'REL-107', source: 'PER-88220', target: 'LOC-502', type: 'CORPORATE_DIRECTOR', confidence: 0.89, evidenceRef: 'EVD-9007' },
    { id: 'REL-108', source: 'PER-88221', target: 'LOC-503', type: 'RESIDENCE_OCCUPANT', confidence: 0.95, evidenceRef: 'EVD-9008' }
  ];

  // 5. Spatio-Temporal Events
  db.events = [
    {
      id: 'EVT-1001',
      eventType: 'CCTV_DETECTION',
      timestamp: '2026-08-24T06:00:00Z',
      locationName: 'Mayfair CCTV Pole 42 (Curzon St)',
      latitude: 51.5074,
      longitude: -0.1478,
      confidence: 0.96,
      associatedEntityIds: ['PER-88219', 'VEH-901', 'LOC-501'],
      description: 'Facial recognition match (96.4%) for Viktor Vance exiting Bentley Bentayga (KX71-FZX) at Mayfair Safehouse.',
      evidenceRef: 'EVD-9001'
    },
    {
      id: 'EVT-1002',
      eventType: 'CDR_CALL_HOP',
      timestamp: '2026-08-24T06:15:00Z',
      locationName: 'Cell Tower UK-LON-881 (Hyde Park North)',
      latitude: 51.5085,
      longitude: -0.1550,
      confidence: 0.92,
      associatedEntityIds: ['PER-88219', 'PER-88221', 'TEL-4412'],
      description: 'Encrypted call duration 412s initiated from +44-7700-900412 to Dubai node +971-50-123-4567.',
      evidenceRef: 'EVD-9002'
    },
    {
      id: 'EVT-1003',
      eventType: 'LPR_SIGHTING',
      timestamp: '2026-08-24T06:30:00Z',
      locationName: 'Heathrow Airport Terminal 5 LPR Gate B',
      latitude: 51.4700,
      longitude: -0.4543,
      confidence: 0.99,
      associatedEntityIds: ['PER-88220', 'VEH-902'],
      description: 'LPR scan logged Silver Mercedes AMG G63 (LX69-WYZ) entering VIP Private Jet Terminal.',
      evidenceRef: 'EVD-9004'
    },
    {
      id: 'EVT-1004',
      eventType: 'BANK_TRANSACTION',
      timestamp: '2026-08-24T06:45:00Z',
      locationName: 'Zurich SWIFT Terminal #099',
      latitude: 47.3667,
      longitude: 8.5333,
      confidence: 1.0,
      associatedEntityIds: ['PER-88219', 'FIN-3391', 'LOC-502'],
      description: 'Wire transfer of €4,500,000 executed from CH93-0024-8819-2091-8 to Cayman Holding Entity.',
      evidenceRef: 'EVD-9005'
    },
    {
      id: 'EVT-1005',
      eventType: 'CCTV_DETECTION',
      timestamp: '2026-08-24T07:10:00Z',
      locationName: 'Dubai International Airport Private Helipad',
      latitude: 25.2532,
      longitude: 55.3657,
      confidence: 0.94,
      associatedEntityIds: ['PER-88221', 'LOC-503'],
      description: 'CCTV facial match for Tariq Al-Mansoor meeting arriving charter flight passenger.',
      evidenceRef: 'EVD-9008'
    }
  ];

  // 6. Evidence Vault & Chain of Custody
  const rawEv1 = "CCTV_FRAME_20260824_MAYFAIR_060000_VIKTOR_VANCE_RAW_CAPTURE";
  const rawEv2 = "CDR_PCAP_STREAM_20260824_061500_CELL_LON881";
  const rawEv3 = "SWIFT_WIRE_ACKNOWLEDGEMENT_ZURICH_88192_EUR_4500000";

  db.evidence = [
    {
      id: 'EVD-9001',
      title: 'CCTV High-Res Frame Capture #4819 (Mayfair)',
      mediaType: 'IMAGE_JPEG',
      fileSize: '4.2 MB',
      sha256: crypto.createHash('sha256').update(rawEv1).digest('hex'),
      classification: 'TOP_SECRET_SCI',
      custodian: 'Dr. Sarah Vance',
      sourceDevice: 'Met Police CCTV Cam #42',
      associatedEntityIds: ['PER-88219', 'VEH-901', 'LOC-501'],
      chainOfCustody: [
        { timestamp: '2026-08-24T06:01:00Z', user: 'Automated Ingestion Pipeline', action: 'INGESTED_AND_HASHED', notes: 'SHA-256 integrity verified upon stream arrival.' },
        { timestamp: '2026-08-24T06:05:00Z', user: 'Dr. Sarah Vance', action: 'ANALYST_VIEWED', notes: 'Verified facial match vector (96.4%). Tagged for Case BLACKSTONE.' }
      ]
    },
    {
      id: 'EVD-9002',
      title: 'Telecom CDR Audio Packet Stream (UK-LON-881)',
      mediaType: 'AUDIO_RAW_PCAP',
      fileSize: '18.7 MB',
      sha256: crypto.createHash('sha256').update(rawEv2).digest('hex'),
      classification: 'TOP_SECRET',
      custodian: 'Marcus Brody',
      sourceDevice: 'GCHQ Intercept Feed #882',
      associatedEntityIds: ['PER-88219', 'PER-88221', 'TEL-4412'],
      chainOfCustody: [
        { timestamp: '2026-08-24T06:16:00Z', user: 'Automated Ingestion Pipeline', action: 'INGESTED_AND_HASHED', notes: 'Encrypted stream metadata parsed.' }
      ]
    },
    {
      id: 'EVD-9005',
      title: 'SWIFT Wire Receipt & Digital Signature Log',
      mediaType: 'PDF_DOCUMENT',
      fileSize: '840 KB',
      sha256: crypto.createHash('sha256').update(rawEv3).digest('hex'),
      classification: 'TOP_SECRET_SCI',
      custodian: 'Dr. Sarah Vance',
      sourceDevice: 'FINCEN SWIFT Monitor',
      associatedEntityIds: ['PER-88219', 'FIN-3391'],
      chainOfCustody: [
        { timestamp: '2026-08-24T06:46:00Z', user: 'Dr. Sarah Vance', action: 'INGESTED_AND_HASHED', notes: 'Financial wire evidence logged into Case BLACKSTONE.' }
      ]
    }
  ];

  // 7. Entity Resolution Candidates
  db.resolutionCandidates = [
    {
      id: 'RES-301',
      entityA: 'PER-88219',
      entityB: 'PER-88222',
      matchScore: 0.94,
      status: 'PENDING_REVIEW',
      reasons: [
        { feature: 'Name Similarity (Jaro-Winkler)', score: 0.92, note: 'Viktor Vance vs V. Vance' },
        { feature: 'Passport No Match', score: 1.0, note: 'Both share Passport GB-99201488' },
        { feature: 'Primary Phone Match', score: 1.0, note: 'Both list +44-7700-900412' },
        { feature: 'Spatio-Temporal Proximity', score: 0.95, note: 'Co-located at Heathrow T5 Terminal' }
      ],
      createdAt: '2026-08-24T06:35:00Z'
    },
    {
      id: 'RES-302',
      entityA: 'PER-88220',
      entityB: 'PER-88219',
      matchScore: 0.72,
      status: 'PENDING_REVIEW',
      reasons: [
        { feature: 'Co-Traveler Correlation', score: 0.88, note: 'Shared 4 flights across Europe' },
        { feature: 'Shared Vehicle Sightings', score: 0.79, note: 'Vehicles sighted together in Mayfair' },
        { feature: 'Name Similarity', score: 0.25, note: 'Distinct names' }
      ],
      createdAt: '2026-08-24T06:40:00Z'
    }
  ];

  // 8. Audit Ledger Initial Entries
  db.logAudit('USR-101', 'Dr. Sarah Vance', 'SYSTEM_INITIALIZATION', 'Platform', 'System booted with synthetic intelligence dataset.');
  db.logAudit('USR-101', 'Dr. Sarah Vance', 'VIEW_SUBJECT_360', 'Subject 360', 'Accessed Subject 360 profile for PER-88219 (Viktor Vance)', 'PER-88219');
  db.logAudit('USR-102', 'Marcus Brody', 'QUERY_KNOWLEDGE_GRAPH', 'Graph Engine', 'Executed dynamic link expansion for Case BLACKSTONE', 'CASE-2026-091');

  console.log(`[SYNTHETIC ENGINE] Data loaded successfully: ${db.entities.length} Entities, ${db.events.length} Events, ${db.cases.length} Cases, ${db.evidence.length} Evidence Vault Records.`);
}

module.exports = { generateSyntheticData };
