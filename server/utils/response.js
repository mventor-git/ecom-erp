/**
 * Standardized response helpers to replace the dozens of inconsistent
 * `res.status(500).json({error: '...'})` and `res.json({success: true, ...})`
 * patterns scattered across route files.
 */

function ok(res, data = {}) {
  return res.json({ success: true, data });
}

function created(res, data = {}) {
  return res.status(201).json({ success: true, data });
}

function fail(res, status, message, extra = {}) {
  return res.status(status).json({ success: false, error: message, ...extra });
}

function notFound(res, message = 'Resource not found') {
  return fail(res, 404, message);
}

function badRequest(res, message = 'Bad request', details) {
  return fail(res, 400, message, details ? { details } : {});
}

function unauthorized(res, message = 'Unauthorized') {
  return fail(res, 401, message);
}

function forbidden(res, message = 'Forbidden') {
  return fail(res, 403, message);
}

function serverError(res, err) {
  const message = (err && err.message) || 'Internal server error';
  return res.status(500).json({ success: false, error: message });
}

module.exports = {
  ok, created, fail, notFound, badRequest,
  unauthorized, forbidden, serverError,
};
