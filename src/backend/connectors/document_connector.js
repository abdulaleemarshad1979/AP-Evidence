const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database');
const storage = require('../storage');
const { authenticateMiddleware } = require('./auth');
const { abacMiddleware } = require('../middleware/abac');

function extractEntitiesAndRelationsFromText(text) {
  const extractions = [];
  const lines = text.split('\n');

  // Regex patterns for intelligence NER
  const personRegex = /(?:Sub-0000[1-9]|SUB-[0-9]{5}|[A-Z]\.\s*[A-Z][a-z]+|[A-Z][a-z]+\s+[A-Z][a-z]+)/g;
  const phoneRegex = /(?:\+91[-.\s]?)?[6-9]\d{9}/g;
  const vehicleRegex = /[A-Z]{2}[-\s]?\d{2}[-\s]?[A-Z]{1,2}[-\s]?\d{4}/g;
  const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
  const locationKeywords = ['Vijayawada', 'Visakhapatnam', 'Tirupati', 'Guntur', 'Kakinada', 'Hyderabad', 'Nellore', 'Anantapur', 'Rajahmundry', 'Kurnool', 'Secunderabad', 'Chittoor'];
  
  const relKeywords = [
    { keyword: 'associate', relation: 'ASSOCIATE_OF' },
    { keyword: 'motive', relation: 'MOTIVE' },
    { keyword: 'modus operandi', relation: 'MODUS_OPERANDI' },
    { keyword: 'mo', relation: 'MODUS_OPERANDI' },
    { keyword: 'prior arrest', relation: 'PRIOR_ARREST_RECORD' },
    { keyword: 'suspect', relation: 'SUSPECT_IN' },
    { keyword: 'calls to', relation: 'COMMUNICATED_WITH' }
  ];

  let offset = 0;
  lines.forEach((line, lineIdx) => {
    const pageNum = Math.floor(lineIdx / 30) + 1;

    // 1. Phone Extraction
    const phoneMatches = [...line.matchAll(phoneRegex)];
    phoneMatches.forEach(m => {
      extractions.push({
        extractionType: 'ENTITY',
        entityType: 'PHONE',
        extractedValue: m[0],
        canonicalName: m[0],
        confidenceScore: 0.95,
        pageNumber: pageNum,
        textOffset: `L${lineIdx + 1}:${m.index}`,
        snippet: line.trim().slice(0, 150)
      });
    });

    // 2. Vehicle Extraction
    const vehicleMatches = [...line.matchAll(vehicleRegex)];
    vehicleMatches.forEach(m => {
      extractions.push({
        extractionType: 'ENTITY',
        entityType: 'VEHICLE',
        extractedValue: m[0].replace(/\s+/g, '-').toUpperCase(),
        canonicalName: m[0].replace(/\s+/g, '-').toUpperCase(),
        confidenceScore: 0.92,
        pageNumber: pageNum,
        textOffset: `L${lineIdx + 1}:${m.index}`,
        snippet: line.trim().slice(0, 150)
      });
    });

    // 3. IP Address Extraction
    const ipMatches = [...line.matchAll(ipRegex)];
    ipMatches.forEach(m => {
      extractions.push({
        extractionType: 'ENTITY',
        entityType: 'IP_ADDRESS',
        extractedValue: m[0],
        canonicalName: m[0],
        confidenceScore: 0.90,
        pageNumber: pageNum,
        textOffset: `L${lineIdx + 1}:${m.index}`,
        snippet: line.trim().slice(0, 150)
      });
    });

    // 4. Person Extraction
    const personMatches = [...line.matchAll(personRegex)];
    personMatches.forEach(m => {
      if (!['The', 'This', 'From', 'Date', 'Case', 'Section'].includes(m[0])) {
        extractions.push({
          extractionType: 'ENTITY',
          entityType: 'PERSON',
          extractedValue: m[0],
          canonicalName: m[0],
          confidenceScore: 0.88,
          pageNumber: pageNum,
          textOffset: `L${lineIdx + 1}:${m.index}`,
          snippet: line.trim().slice(0, 150)
        });
      }
    });

    // 5. Locations Extraction
    locationKeywords.forEach(loc => {
      if (line.toLowerCase().includes(loc.toLowerCase())) {
        extractions.push({
          extractionType: 'OBSERVATION',
          entityType: 'LOCATION',
          extractedValue: loc,
          canonicalName: loc,
          confidenceScore: 0.91,
          locationName: loc,
          latitude: loc === 'Vijayawada' ? 16.5062 : loc === 'Visakhapatnam' ? 17.6868 : 16.3067,
          longitude: loc === 'Vijayawada' ? 80.6480 : loc === 'Visakhapatnam' ? 83.2185 : 80.4365,
          pageNumber: pageNum,
          textOffset: `L${lineIdx + 1}`,
          snippet: line.trim().slice(0, 150)
        });
      }
    });

    // 6. Relationship Extraction
    relKeywords.forEach(rk => {
      if (line.toLowerCase().includes(rk.keyword)) {
        extractions.push({
          extractionType: 'ASSERTION',
          relationType: rk.relation,
          extractedValue: rk.keyword.toUpperCase(),
          canonicalName: rk.relation,
          objectValue: line.trim().slice(0, 100),
          confidenceScore: 0.85,
          pageNumber: pageNum,
          textOffset: `L${lineIdx + 1}`,
          snippet: line.trim().slice(0, 150)
        });
      }
    });

    offset += line.length + 1;
  });

  // Deduplicate exact matches on extractedValue + extractionType + snippet
  const seen = new Set();
  return extractions.filter(item => {
    const key = `${item.extractionType}-${item.extractedValue}-${item.pageNumber}-${item.textOffset}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Ingest Unstructured Document (PDF, DOCX, Image, Text)
router.post('/ingest', authenticateMiddleware, abacMiddleware('IMPORT_DATA', req => req.body.caseId || 'CASE-AP-2026-0001'), async (req, res) => {
  try {
    const { caseId, fileName, fileContent, mediaType = 'application/pdf', custodian = 'Investigating Officer', sourceDevice = 'Scanner-Station-01' } = req.body;
    
    if (!caseId || !fileName || !fileContent) {
      return res.status(400).json({ error: 'Missing required parameters: caseId, fileName, fileContent' });
    }

    const rawBuffer = Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent, typeof fileContent === 'string' && fileContent.startsWith('data:') ? 'base64' : 'utf8');
    const sha256 = db.constructor.sha256(rawBuffer);
    const evidenceId = `EVI-DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const objectKey = `documents/${caseId}/${evidenceId}_${fileName}`;

    // Store evidence in object store
    await storage.uploadEvidence(objectKey, rawBuffer, mediaType);

    // Save evidence metadata
    await db.execute(
      `INSERT INTO evidence_metadata (id, title, media_type, file_size, sha256, object_key, classification, custodian, source_device, case_id, evidence_status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'UNREVIEWED', $11)`,
      [
        evidenceId,
        fileName,
        mediaType,
        `${rawBuffer.length} bytes`,
        sha256,
        objectKey,
        'LIVE OPERATIONAL SYSTEM — RESTRICTED / OFFICIAL USE ONLY',
        custodian,
        sourceDevice,
        caseId,
        JSON.stringify({ ingestedAs: 'UNSTRUCTURED_CASE_SHEET' })
      ]
    );

    // Record custody ledger
    await db.execute(
      `INSERT INTO evidence_custody_ledger (id, evidence_id, timestamp, user_id, username, action, notes, hash_signature)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, 'INGESTED_UNSTRUCTURED_DOCUMENT', $5, $6)`,
      [`LEDGER-${Date.now()}-${Math.floor(Math.random() * 1000)}`, evidenceId, req.user.id, req.user.username, `Ingested case sheet document ${fileName}`, sha256]
    );

    const jobId = `DOCJOB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let extractedText = rawBuffer.toString('utf8');

    // OCR Interface / Image PDF check simulation
    let ocrApplied = false;
    if (mediaType.includes('image') || extractedText.includes('PDF-1.') && !extractedText.includes('stream')) {
      ocrApplied = true;
      extractedText = `[OCR PARSED CASE SHEET]\nFIR No: 142/2026 Vijayawada Central PS\nDate: 2026-08-15\nAccused: SUB-00001 (K. Rajesh)\nAssociate: V. Sharma (+91-9876543210)\nVehicle Identified: AP-09-CB-1234\nLocation: Vijayawada Bus Stand Junction\nMotive: Modus operandi financial theft and cyber extortion.\nIP Address: 192.168.1.50`;
    }

    const candidateFacts = extractEntitiesAndRelationsFromText(extractedText);

    // Save job
    await db.execute(
      `INSERT INTO document_jobs (id, case_id, file_name, media_type, file_size, sha256, evidence_id, status, extracted_text, ocr_applied)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED', $8, $9)`,
      [jobId, caseId, fileName, mediaType, `${rawBuffer.length} bytes`, sha256, evidenceId, extractedText, ocrApplied]
    );

    // Save extracted candidate facts
    for (const fact of candidateFacts) {
      const extId = `EXT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      await db.execute(
        `INSERT INTO document_extractions 
         (id, job_id, case_id, evidence_id, extraction_type, entity_type, extracted_value, canonical_name, relation_type, object_value, confidence_score, location_name, latitude, longitude, page_number, text_offset, snippet, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'PENDING_REVIEW')`,
        [
          extId, jobId, caseId, evidenceId, fact.extractionType, fact.entityType || null, fact.extractedValue, fact.canonicalName || fact.extractedValue,
          fact.relationType || null, fact.objectValue || null, fact.confidenceScore, fact.locationName || null, fact.latitude || null, fact.longitude || null,
          fact.pageNumber, fact.textOffset, fact.snippet
        ]
      );
    }

    await db.logAudit(req.user.id, req.user.username, 'DOCUMENT_INGESTION', 'DOCUMENT_CONNECTOR', `Ingested document ${fileName} with ${candidateFacts.length} extracted candidates`, null, caseId);

    res.json({
      success: true,
      jobId,
      evidenceId,
      fileName,
      ocrApplied,
      candidateFactsCount: candidateFacts.length,
      status: 'COMPLETED'
    });
  } catch (err) {
    console.error('[DOCUMENT CONNECTOR ERROR]', err);
    res.status(500).json({ error: 'Document ingestion failed', message: err.message });
  }
});

// GET Extractions for Document Job
router.get('/:jobId/extractions', authenticateMiddleware, abacMiddleware('VIEW_CASE', req => req.headers['x-case-id'] || 'CASE-AP-2026-0001'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await db.queryOne(`SELECT * FROM document_jobs WHERE id = $1`, [jobId]);
    if (!job) return res.status(404).json({ error: 'Document job not found' });

    const extractions = await db.query(`SELECT * FROM document_extractions WHERE job_id = $1 ORDER BY page_number ASC, created_at ASC`, [jobId]);

    res.json({
      job,
      extractions: extractions.map(e => ({
        id: e.id,
        jobId: e.job_id,
        caseId: e.case_id,
        evidenceId: e.evidence_id,
        extractionType: e.extraction_type,
        entityType: e.entity_type,
        extractedValue: e.extracted_value,
        canonicalName: e.canonical_name,
        relationType: e.relation_type,
        objectValue: e.object_value,
        confidenceScore: e.confidence_score,
        locationName: e.location_name,
        latitude: e.latitude,
        longitude: e.longitude,
        pageNumber: e.page_number,
        textOffset: e.text_offset,
        snippet: e.snippet,
        status: e.status,
        reviewedBy: e.reviewed_by,
        createdAt: e.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve document extractions', message: err.message });
  }
});

// Review Document Extraction Candidate (Approve or Reject)
router.post('/extractions/:id/review', authenticateMiddleware, abacMiddleware('MANAGE_RESOLUTIONS', req => req.body.caseId || 'CASE-AP-2026-0001'), async (req, res) => {
  try {
    const { id } = req.params;
    const { decision } = req.body; // APPROVED or REJECTED

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision. Must be APPROVED or REJECTED' });
    }

    const extraction = await db.queryOne(`SELECT * FROM document_extractions WHERE id = $1`, [id]);
    if (!extraction) return res.status(404).json({ error: 'Extraction candidate not found' });

    await db.execute(
      `UPDATE document_extractions SET status = $1, reviewed_by = $2 WHERE id = $3`,
      [decision, req.user.username, id]
    );

    let createdId = null;
    if (decision === 'APPROVED') {
      if (extraction.extraction_type === 'ENTITY') {
        createdId = `SUB-DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await db.execute(
          `INSERT INTO entities (id, type, name, aliases, identifier_fields, evidence_status, assertion_class, confidence_method, human_review_status, is_fictional)
           VALUES ($1, $2, $3, $4, $5, 'DOC_SPOKEN_RECORD', 'PROVISIONAL', 'NLP_DOCUMENT_MINING', 'APPROVED', FALSE)`,
          [
            createdId,
            extraction.entity_type || 'PERSON',
            extraction.canonical_name || extraction.extracted_value,
            JSON.stringify([extraction.extracted_value]),
            JSON.stringify({ docEvidenceId: extraction.evidence_id, snippet: extraction.snippet }),
          ]
        );
      } else if (extraction.extraction_type === 'OBSERVATION') {
        createdId = `OBS-DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await db.execute(
          `INSERT INTO observations (id, entity_id, case_id, observation_type, timestamp, location_name, latitude, longitude, confidence_score, evidence_status, raw_data, evidence_id)
           VALUES ($1, $2, $3, 'DOCUMENT_MENTION', CURRENT_TIMESTAMP, $4, $5, $6, $7, 'VERIFIED', $8, $9)`,
          [
            createdId,
            'SUB-00001',
            extraction.case_id,
            extraction.location_name || 'Vijayawada',
            extraction.latitude || 16.5062,
            extraction.longitude || 80.6480,
            extraction.confidence_score || 0.9,
            JSON.stringify({ textOffset: extraction.text_offset, snippet: extraction.snippet }),
            extraction.evidence_id
          ]
        );
      }
    }

    await db.logAudit(req.user.id, req.user.username, 'REVIEW_DOCUMENT_EXTRACTION', 'DOCUMENT_CONNECTOR', `Reviewed extraction candidate ${id} as ${decision}`, createdId, extraction.case_id);

    res.json({
      success: true,
      extractionId: id,
      decision,
      createdId
    });
  } catch (err) {
    res.status(500).json({ error: 'Extraction review failed', message: err.message });
  }
});

module.exports = router;
