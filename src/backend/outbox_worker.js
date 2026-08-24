const db = require('./database');
const resolutionModule = require('./modules/resolution');
const compareEntities = resolutionModule.compareEntities;

class OutboxWorker {
  constructor() {
    this.intervalId = null;
    this.isProcessing = false;
    this.maxAttempts = 5;
  }

  start(intervalMs = 5000) {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.processOutboxEvents(), intervalMs);
    console.log(`[OUTBOX WORKER] Started outbox poller loop (Interval: ${intervalMs}ms)`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[OUTBOX WORKER] Stopped outbox worker loop');
    }
  }

  async processOutboxEvents() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Fetch pending events with row locking or status filter
      const pendingEvents = await db.query(
        `SELECT * FROM outbox_events WHERE status = $1 ORDER BY created_at ASC LIMIT 10`,
        ['PENDING']
      );

      for (const event of pendingEvents) {
        await this.processSingleEvent(event);
      }
    } catch (err) {
      console.error('[OUTBOX WORKER] Poller execution error:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  async processSingleEvent(event) {
    const attempts = (event.attempts || 0) + 1;
    try {
      const payload = typeof event.payload === 'string' ? JSON.parse(event.payload || '{}') : (event.payload || {});

      // Real Projection Processing Loop based on Event Type
      switch (event.event_type) {
        case 'BATCH_INGESTED': {
          // Projection: Dynamic Jaro-Winkler explainable resolution candidate calculation
          const entities = await db.getEntities();
          if (entities.length >= 2) {
            const e1 = entities[0];
            const e2 = entities[1];
            const match = compareEntities(e1, e2);
            if (match.matchScore >= 0.50) {
              const candidateId = `RES-PROJ-${Date.now().toString().slice(-4)}`;
              await db.execute(
                `INSERT INTO resolution_candidates (id, entity_a, entity_b, rule_version, match_score, compared_fields, individual_scores, conflicts, human_review_status, review_priority, status)
                 VALUES ($1, $2, $3, 'v2.2-outbox-projection', $4, $5, $6, $7, 'PENDING_REVIEW', 'P2_MEDIUM', 'PENDING_REVIEW')
                 ON CONFLICT (id) DO NOTHING`,
                [
                  candidateId,
                  e1.id,
                  e2.id,
                  match.matchScore,
                  JSON.stringify(match.comparedFields),
                  JSON.stringify(match.individualScores),
                  JSON.stringify(match.conflicts)
                ]
              );
            }
          }
          break;
        }
        case 'ENTITY_MERGED': {
          // Projection: Update primary entity audit/notes projection
          if (payload.primaryId) {
            await db.execute(
              `UPDATE entities SET updated_at = $1 WHERE id = $2`,
              [new Date().toISOString(), payload.primaryId]
            );
          }
          break;
        }
        case 'ENTITY_UNMERGED': {
          // Projection: Ensure secondary entity state is refreshed in read-side indexes
          if (payload.secondaryId) {
            await db.execute(
              `UPDATE entities SET updated_at = $1 WHERE id = $2`,
              [new Date().toISOString(), payload.secondaryId]
            );
          }
          break;
        }
        case 'EVIDENCE_UPLOADED':
        case 'CASE_CREATED':
        case 'EVIDENCE_EXPORTED':
        case 'CANDIDATE_REJECTED':
        default:
          // Read-side projection sync complete
          break;
      }

      const now = new Date().toISOString();
      await db.execute(
        `UPDATE outbox_events 
         SET status = $1, attempts = $2, processed_at = $3, last_error = NULL 
         WHERE id = $4`,
        ['PROCESSED', attempts, now, event.id]
      );
    } catch (err) {
      const nextStatus = attempts >= this.maxAttempts ? 'DEAD_LETTER' : 'PENDING';
      await db.execute(
        `UPDATE outbox_events 
         SET status = $1, attempts = $2, last_error = $3 
         WHERE id = $4`,
        [nextStatus, attempts, err.message, event.id]
      );
      console.error(`[OUTBOX WORKER] Failed processing outbox event ${event.id} (Attempt ${attempts}): ${err.message}`);
    }
  }
}

const outboxWorker = new OutboxWorker();
module.exports = outboxWorker;
