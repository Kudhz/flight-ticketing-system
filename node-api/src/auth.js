import crypto from "node:crypto";
import express, { Router } from "express";
import { InvalidInput, HttpError, requireJsonObject, wrap } from "./http.js";

const COOKIE_NAME = "lupin_finance";
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

const digest = (value) => crypto.createHash("sha256").update(String(value)).digest();
const equalText = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));
const base64url = (buffer) => Buffer.from(buffer).toString("base64url");

export function createFinanceAuth({ username, password, sessionSecret }) {
  const configured =
    typeof username === "string" &&
    username !== "" &&
    username.length <= 100 &&
    typeof password === "string" &&
    password !== "" &&
    password.length <= 4096;

  // Tanpa SESSION_SECRET, kunci diturunkan dari kredensial sehingga mengganti password mencabut semua sesi.
  const secret = sessionSecret || digest(`finance-session:${username}:${password}`).toString("hex");
  const sign = (payload) => base64url(crypto.createHmac("sha256", secret).update(payload).digest());

  const readCookie = (req) => {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(";")) {
      const index = part.indexOf("=");
      if (index > 0 && part.slice(0, index).trim() === COOKIE_NAME) {
        return decodeURIComponent(part.slice(index + 1).trim());
      }
    }
    return null;
  };

  const isSecureRequest = (req) =>
    req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";

  return {
    configured,

    isAuthenticated(req) {
      if (!configured) return false;
      const token = readCookie(req);
      if (!token) return false;

      const [payload, signature, extra] = token.split(".");
      if (!payload || !signature || extra !== undefined) return false;

      const expected = Buffer.from(sign(payload));
      const received = Buffer.from(signature);
      if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
        return false;
      }

      try {
        const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return (
          typeof session.u === "string" &&
          equalText(session.u, username) &&
          typeof session.exp === "number" &&
          session.exp > Date.now()
        );
      } catch {
        return false;
      }
    },

    verifyCredentials(candidateUsername, candidatePassword) {
      // Kedua perbandingan selalu dijalankan agar waktu respons tidak membocorkan field yang salah.
      const validUsername = equalText(username, candidateUsername);
      const validPassword = equalText(password, candidatePassword);
      return validUsername && validPassword;
    },

    startSession(req, res) {
      const payload = base64url(JSON.stringify({ u: username, exp: Date.now() + SESSION_LIFETIME_MS }));
      res.cookie(COOKIE_NAME, `${payload}.${sign(payload)}`, {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecureRequest(req),
        path: "/",
      });
    },

    endSession(req, res) {
      res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecureRequest(req),
        path: "/",
      });
    },
  };
}

export function financeRouter(auth) {
  const router = Router();
  router.use(express.json({ limit: "16kb", type: () => true }));

  const methodNotAllowed = (allow) => (req, res) => {
    res.set("Allow", allow);
    throw new HttpError(405, { error: "Method tidak didukung." });
  };

  router
    .route("/session")
    .get((req, res) => {
      res.json({ configured: auth.configured, authenticated: auth.isAuthenticated(req) });
    })
    .all(methodNotAllowed("GET"));

  router
    .route("/login")
    .post(
      wrap((req, res) => {
        if (!auth.configured) {
          throw new HttpError(503, { error: "Login Keuangan belum dikonfigurasi di server." });
        }

        const { username, password } = requireJsonObject(req);
        if (
          typeof username !== "string" ||
          username.length > 100 ||
          typeof password !== "string" ||
          password.length > 4096
        ) {
          throw new InvalidInput("Username atau kata sandi tidak valid.");
        }
        if (!auth.verifyCredentials(username, password)) {
          throw new HttpError(401, { error: "Username atau kata sandi salah." });
        }

        auth.startSession(req, res);
        res.json({ authenticated: true });
      }),
    )
    .all(methodNotAllowed("POST"));

  router
    .route("/logout")
    .post((req, res) => {
      auth.endSession(req, res);
      res.json({ authenticated: false });
    })
    .all(methodNotAllowed("POST"));

  return router;
}
