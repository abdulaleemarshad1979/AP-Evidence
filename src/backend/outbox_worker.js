const db = require('./database');

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
      // Simulate processing event emission (e.g. to message bus / external subscriber)
      // In production stack, this publishes to Kafka / NATS / Redis PubSub.
      
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
