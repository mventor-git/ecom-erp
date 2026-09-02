// Simple session-based admin authentication middleware
function adminAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Admin login required.' });
}

module.exports = adminAuth;
