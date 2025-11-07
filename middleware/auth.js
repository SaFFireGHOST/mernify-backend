const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'please-change-this';

function verifyToken(req, res, next) {
  // Expect header: Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'missing authorization header' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'malformed authorization header' });

  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}

module.exports = { verifyToken };
