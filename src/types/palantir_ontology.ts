// Palantir Enterprise Intelligence OS - Spatio-Temporal Observation Ontology & System Types

export type SourceType =
  | 'CCTV_ANALYTICS'
  | 'ANPR_CAMERA'
  | 'VEHICLE_REGISTRY'
  | 'FIELD_REPORT'
  | 'AUTHORIZATION_RECORD'
  | 'CDR_TRIANGULATION'
  | 'BANK_SWIFT';

export type ClearanceLevel = 1 | 2 | 3 | 4;

export type SystemRole = 'Admin' | 'Lead Investigator' | 'Field Analyst' | 'Auditor';

export interface UserSessionContext {
  userId: string;
  username: string;
  name: string;
  role: SystemRole;
  clearanceLevel: ClearanceLevel;
  department: string;
  assignedCases: string[];
}

export interface ObservationEvent {
  id: string; // e.g. "EVT-918293"
  subjectId: string; // e.g. "P-002917"
  timestamp: string; // ISO 8601
  locationId: string;
  coordinates: [number, number]; // [lat, lng]
  source: SourceType;
  sourceLabel: string; // e.g. "CCTV-41", "ANPR-17"
  confidence: number; // 0.0 - 1.0
  direction?: 'Northbound' | 'Southbound' | 'Eastbound' | 'Westbound';
  associatedVehicleId?: string;
  metadata?: Record<string, any>;
  speedKmh?: number;
  isAnomaly?: boolean;
  anomalyReason?: string;
}

export interface RelationshipLink {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: 'POSSIBLE_OWNER' | 'ASSOCIATE' | 'FREQUENT_CO_LOCATED' | 'FAMILY' | 'CO_ACCUSED' | 'OPERATES' | 'BENEFICIAL_OWNER';
  confidence: number;
  validFrom: string;
  validTo?: string;
  evidenceSource: string;
  caseId: string;
}

export interface Subject360 {
  canonicalId: string; // "P-002917"
  name: string;
  aliases: string[];
  photoUrl: string;
  clearanceRequired: ClearanceLevel;
  identifiers: {
    nationalId?: string;
    phoneNumbers: string[];
    registeredVehicles: string[];
  };
  knownAddresses: Array<{ address: string; coordinates: [number, number]; type: string }>;
  associatedCases: string[];
  riskScore: number;
  baselineRoutine: {
    frequentLocations: Array<{ locationId: string; name: string; visitCount: number; coords: [number, number] }>;
    timeDistribution: Record<string, number>; // e.g. "06-09": 14
  };
  provenance: {
    sourceDataset: string;
    lastVerifiedTimestamp: string;
    confidenceScore: number;
  };
}

export interface CoLocationMatch {
  locationId: string;
  locationName: string;
  coordinates: [number, number];
  subjects: string[];
  timeWindow: {
    start: string;
    end: string;
  };
  distanceMeters: number;
  observationCount: number;
}

export interface InvestigativeBrief {
  briefId: string;
  subjectId: string;
  generatedAt: string;
  authorModel: string;
  summary: string;
  verifiedEvidence: Array<{ evidenceId: string; title: string; sha256: string }>;
  behavioralAnomalies: Array<{ eventId: string; anomalyType: string; description: string }>;
  coLocationLeads: CoLocationMatch[];
  recommendedActions: string[];
  confidenceCalibration: {
    physicalEvidenceScore: number;
    algorithmicInferenceScore: number;
  };
}
