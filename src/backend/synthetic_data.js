function generateSyntheticCaseSheets() {
  return [
    {
      fileName: 'FIR_142_2026_Vijayawada_Central.txt',
      mediaType: 'text/plain',
      caseId: 'CASE-AP-2026-0001',
      fileContent: `ANDHRA PRADESH POLICE DEPARTMENT
FIRST INFORMATION REPORT (Under Section 154 Cr.P.C.)
FIR No: 142/2026 | Police Station: Vijayawada Central PS | Date: 2026-08-15

Subject/Accused: SUB-00001 (K. Rajesh, alias "Rajesh Varma")
Associate: V. Sharma (+91-9876543210)
Vehicle Identified: AP-09-CB-1234 (Black SUV)
Location of Incident: Vijayawada Bus Stand Junction (Lat: 16.5062, Lng: 80.6480)
Motive / Modus Operandi: Organized financial extortion and coordinated cyber theft targeting commercial bank accounts.
Prior Arrest Record: Suspect involved in prior fraud cases at Visakhapatnam in 2024.
Network Telemetry: IP Address 192.168.1.50 accessed secure endpoint.`
    },
    {
      fileName: 'Chargesheet_Scanned_Visakhapatnam_Case402.txt',
      mediaType: 'text/plain',
      caseId: 'CASE-AP-2026-0001',
      fileContent: `CRIME INVESTIGATION DEPARTMENT — ANDHRA PRADESH
FINAL CHARGESHEET REPORT
Case Reference: CASE-AP-2026-0001 | Date: 2026-08-18

Accused Name: R. Naidu (+91-9123456789)
Location: Visakhapatnam Port Node (Lat: 17.6868, Lng: 83.2185)
Suspected Associate: SUB-00001 (K. Rajesh)
Vehicle Used: AP-31-XY-9988
Summary: Evidence indicates suspect communicated with associate prior to vehicle movement toward Guntur.`
    }
  ];
}

async function generateSyntheticData(db) {
  console.log('[OPERATIONAL ENGINE] Database initialized. Ready for real operational data integration.');
  await db.init();
}

module.exports = { generateSyntheticData, generateSyntheticCaseSheets };
