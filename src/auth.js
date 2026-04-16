const session = require("express-session");

const CRM_PASSWORD = process.env.CRM_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET || "crm-default-secret";

function sessionMiddleware() {
  return session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: "lax"
    }
  });
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ error: "Not authenticated" });
}

function login(req, res) {
  const { password } = req.body;
  if (!CRM_PASSWORD) {
    return res.status(500).json({ error: "CRM_PASSWORD not configured on server" });
  }
  if (password === CRM_PASSWORD) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: "Invalid password" });
}

function logout(req, res) {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
}

function checkAuth(req, res) {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
}

module.exports = { sessionMiddleware, requireAuth, login, logout, checkAuth };
