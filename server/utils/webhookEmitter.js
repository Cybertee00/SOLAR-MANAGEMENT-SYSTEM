const crypto = require('crypto');

async function deliverWebhook({ url, secret, eventName, payload }) {
  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': eventName
  };

  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-Webhook-Signature'] = `sha256=${sig}`;
  }

  // Node 18+ has fetch; if not available, this will throw and we’ll mark delivery failed.
  const res = await fetch(url, { method: 'POST', headers, body });
  const text = await res.text().catch(() => '');
  return { status: res.status, body: text };
}

/**
 * Emit an event to all active webhooks subscribed to it.
 * Best-effort: errors are captured in webhook_deliveries, but should not break the main request.
 */
async function emitEvent(pool, eventName, payload) {
  try {
    const hooks = await pool.query(
      `SELECT id, url, secret, events
       FROM webhooks
       WHERE is_active = true`
    );

    for (const hook of hooks.rows) {
      const events = (typeof hook.events === 'string') ? JSON.parse(hook.events) : (hook.events || []);
      if (!Array.isArray(events) || (events.length > 0 && !events.includes(eventName))) continue;

      const delivery = await pool.query(
        `INSERT INTO webhook_deliveries (webhook_id, event_name, status, attempts, payload)
         VALUES ($1, $2, 'pending', 0, $3::jsonb)
         RETURNING id`,
        [hook.id, eventName, JSON.stringify(payload)]
      );
      const deliveryId = delivery.rows[0].id;

      try {
        const result = await deliverWebhook({
          url: hook.url,
          secret: hook.secret,
          eventName,
          payload
        });

        await pool.query(
          `UPDATE webhook_deliveries
           SET status = $1,
               attempts = attempts + 1,
               last_attempt_at = CURRENT_TIMESTAMP,
               response_status = $2,
               response_body = $3
           WHERE id = $4`,
          [result.status >= 200 && result.status < 300 ? 'success' : 'failed', result.status, result.body, deliveryId]
        );
      } catch (e) {
        await pool.query(
          `UPDATE webhook_deliveries
           SET status = 'failed',
               attempts = attempts + 1,
               last_attempt_at = CURRENT_TIMESTAMP,
               response_body = $1
           WHERE id = $2`,
          [String(e?.message || e), deliveryId]
        );
      }
    }
  } catch (e) {
    // swallow
  }
}

module.exports = { emitEvent };


