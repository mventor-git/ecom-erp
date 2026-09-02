/**
 * Wraps an async route handler so unhandled rejections are caught
 * and passed to Express's error middleware as res.status(500).json({error}).
 * Usage: router.get('/foo', asyncHandler(async (req, res, next) => { ... }))
 *
 * @param {Function} fn - async function(req, res, next)
 * @returns {Function} sync wrapper
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
