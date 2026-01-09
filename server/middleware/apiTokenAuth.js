const bcrypt = require('bcrypt');

/**
 * Optional API token authentication middleware.
 *
 * Supports:
 *   Authorization: Bearer tok_<uuid>_<secret>
 *
 * If valid, populates req.session.userId / role so existing requireAuth/requireAdmin work.
 * Does NOT create a persistent browser session cookie on its own.
 */
module.exports = (pool) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || typeof authHeader !== 'string') return next();

      const [type, token] = authHeader.split(' ');
      if (type !== 'Bearer' || !token) return next();

      if (!token.startsWith('tok_')) return next();

      // tok_<id>_<secret>
      const parts = token.split('_');
      if (parts.length < 3) return next();

      const tokenId = parts[1];
      const secret = parts.slice(2).join('_');

      // Lookup token record
      const result = await pool.query(
        'SELECT id, name, role, user_id, secret_hash, is_active FROM api_tokens WHERE id = $1',
        [tokenId]
      );

      if (result.rows.length === 0) return next();
      const rec = result.rows[0];
      if (!rec.is_active) return next();

      const ok = await bcrypt.compare(secret, rec.secret_hash);
      if (!ok) return next();

      // Ensure req.session exists
      if (!req.session) req.session = {};

      // Populate session-like context so existing middleware and routes work unchanged
      // Token acts as a real user (user_id) so DB relations keep working.
      req.session.userId = rec.user_id;
      req.session.username = rec.name;
      req.session.role = rec.role || 'admin';
      req.session.isApiToken = true;

      // Touch last_used (best-effort)
      pool.query('UPDATE api_tokens SET last_used = CURRENT_TIMESTAMP WHERE id = $1', [rec.id]).catch(() => {});

      return next();
    } catch (e) {
      // Never break requests because token parsing failed; treat as unauthenticated.
      return next();
    }
  };
};


