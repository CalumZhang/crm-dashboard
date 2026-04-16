const express = require("express");
const { login, logout, checkAuth } = require("../auth");

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);
router.get("/auth/check", checkAuth);

module.exports = router;
