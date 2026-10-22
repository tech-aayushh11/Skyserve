# SKYSERVE // AI Readiness Rocket Launch Checker

Aerospace mission-control decision support platform for high-power rocketry and launch vehicle readiness validation. Built with pure Node.js built-in modules (`http`, `fs`, `path`, `crypto`) with zero external frameworks or build steps.

---

## Security & Authentication Architecture

SKYSERVE enforces strict authentication and role-based access control (RBAC). No unauthenticated visitor can view or access telemetry or the mission dashboard.

### Core Security Highlights:
- **Zero Third-Party Dependencies:** Powered entirely by Node.js built-ins (`crypto`, `http`, `fs`, `path`).
- **Cryptographic Password Hashing:** Uses `crypto.scrypt` with a unique 16-byte cryptographically secure random salt, verified with constant-time `crypto.timingSafeEqual`. Plaintext passwords are never logged or stored.
- **Role-Based Access Control:** Two distinct roles:
  - `ADMIN`: Full authority to manage personnel accounts, reset temporary passphrases, enable/disable users, and review the security audit trail. Cannot delete or demote themselves or the last active administrator.
  - `USER`: Access to launch checklists, mission countdown, weather parameters, and telemetry validation.
- **Strict Password Policy:** Minimum 10 characters, requiring at least one uppercase letter, one lowercase letter, one numeric digit, and one special symbol.
- **Rate Limiting:** Protects against brute-force attacks by limiting failed login attempts to a maximum of 5 per 15 minutes per username + IP address.
- **Path Traversal & Static Asset Protection:** Only whitelisted public files (`login.html`, `css/`, `js/login.js`, `assets/`, `favicon.ico`) are served to unauthenticated users. Files such as `server.js`, `package.json`, `.env`, and files in `data/` are strictly blocked.
- **HttpOnly Session Cookies:** Session tokens (32-byte cryptographically random hex) are stored server-side with an 8-hour expiration and delivered via `HttpOnly; SameSite=Strict; Path=/` cookies. Tokens and passwords are never stored in `localStorage` or `sessionStorage`.

---

## Setup & Running Guide

### 1. Configure Initial Admin Passwords
Initial administrator accounts (`aayush.devre` and `gayatri.kakade`) are automatically seeded on first launch.

Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

Edit `.env` to specify initial passwords:
```env
PORT=8080
ADMIN_AAYUSH_PASSWORD=SkyServe#Aayush2026!
ADMIN_GAYATRI_PASSWORD=SkyServe#Gayatri2026!
```

> **Note:** If `.env` is omitted or initial passwords are left blank, SKYSERVE will generate strong random temporary passwords on the first run and print them once in the terminal console. Both administrators will be required to rotate their password at first login (`mustChangePassword: true`).

### 2. Start the Server
Start the plain Node server (no npm install or build step required):
```bash
node server.js
```
The application will be accessible at:
🔗 **http://localhost:8080/**

### 3. First Login & Password Rotation
1. Navigate to **http://localhost:8080/** in your browser. Unauthenticated requests are automatically routed to `login.html`.
2. Sign in with either admin account:
   - Username: `aayush.devre` or `gayatri.kakade`
   - Password: configured initial password or the one-time generated password from console.
3. Upon first login, the security gate will require rotating the temporary password to a new personal passphrase meeting the complexity policy.

### 4. Creating New Users (Admins Only)
There is no public user registration. Only administrators can provision user accounts:
1. Log in with an `ADMIN` account.
2. In the left aerospace sidebar or top-right profile dropdown, select **Admin Panel**.
3. Click **Create User Account**.
4. Enter the user's Full Name, Username, optional Email, and Role (`ADMIN` or `USER`).
5. Click **Generate Account & Passphrase**.
6. The system will generate a strong one-time temporary passphrase and display it with a copy button. Provide this temporary passphrase to the user securely.
7. Upon the user's first login, they will be required to choose their permanent password.

### 5. Managing Accounts & Audit Trail
From the **Admin Panel**, administrators can:
- **Reset Password:** Generates a new temporary passphrase and forces credential rotation on next login.
- **Disable / Enable:** Temporarily suspend access and terminate any active sessions.
- **Delete Account:** Irreversibly delete a user (self-deletion and deleting the last admin are prevented).
- **Inspect Audit Trail:** Review timestamps, event types, actors, IP addresses, and outcomes for logins, failed attempts, and administrative actions.

---

## Production Deployment & Operational Readiness

SKYSERVE is production-ready for deployment behind reverse proxies (Nginx, Traefik, AWS ALB, Cloudflare):

```bash
# Run in production on custom port with external data volume
NODE_ENV=production PORT=3000 DATA_DIR=/data node server.js
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Set to `production` to enable Secure cookies and X-Forwarded-Proto handling |
| `PORT` | `8080` | HTTP listening port |
| `DATA_DIR` | `./data` | Absolute path to the data directory. **In production this should be a mounted persistent volume** (e.g. `/data`). All users, audit logs, sessions, and backups are stored here. |
| `ADMIN_AAYUSH_PASSWORD` | _(auto-generated)_ | Initial password for `aayush.devre`. Read once on first run only. |
| `ADMIN_GAYATRI_PASSWORD` | _(auto-generated)_ | Initial password for `gayatri.kakade`. Read once on first run only. |
| `SESSION_SECRET` | _(reserved)_ | Reserved for future HMAC-signed token upgrades. |

### Production Features

- **Host Binding:** Listens on `0.0.0.0` with configurable `PORT` (defaults to 8080).
- **HTTPS & Secure Cookies:** When `NODE_ENV=production` or `X-Forwarded-Proto: https` is present, session cookies automatically include the `; Secure` flag alongside `SameSite=Strict` and `HttpOnly`.
- **Health Check Endpoint:** `GET /healthz` returns `200 {"status":"ok"}` with `Cache-Control: no-store` (unauthenticated for orchestrator/load balancer probes).
- **Gzip Compression:** Built-in `zlib` automatically compresses text assets (`html`, `css`, `js`, `json`) when requested by client `Accept-Encoding: gzip`.
- **HTTP Caching Policies:**
  - Static assets (`/css/*`, `/js/*`): `Cache-Control: public, max-age=3600`.
  - Dynamic & Sensitive routes (`/`, `login.html`, `/api/*`, `/healthz`): `Cache-Control: no-store`.
- **Graceful Shutdown:** Handles `SIGTERM` and `SIGINT` cleanly, closes HTTP listener, flushes pending state to `DATA_DIR/`, and safely exits with code 0.
- **Audit-Safe Request Logging:** Logs `METHOD PATH STATUS DURATION` without exposing cookies, passwords, or request payloads.
- **Process Guard:** Process-level `uncaughtException` and `unhandledRejection` handlers log error stacks and fail fast.

### Storage & Persistence

All persistent state lives inside `DATA_DIR`:

| File | Purpose |
|---|---|
| `users.json` | All user accounts and hashed passwords |
| `audit.json` | Security audit trail (up to 2 000 entries) |
| `sessions.json` | Active sessions keyed by SHA-256(token). Loaded at startup so users stay logged in across restarts. |
| `backups/users.YYYY-MM-DD.json` | Daily snapshots of `users.json`. Last 7 days are kept automatically. |

**Admin seeding** only runs when `users.json` does not yet exist. Redeploying the server never overwrites real users or resets passwords.

**Session tokens** are 32-byte cryptographically random hex values sent only via `HttpOnly` cookies. Only a SHA-256 hash of each token is written to `sessions.json`, so a leaked file cannot be replayed directly.

**Writes** are serialised per file through an async write queue and committed atomically (write temp file → rename), so concurrent requests cannot corrupt storage.

---

> ⚠️ **Single-Instance Notice**
>
> SKYSERVE stores all state in local files within `DATA_DIR`. This architecture is designed for **a single running process**. Do **not** scale horizontally to multiple instances without first migrating storage to a shared database (e.g. PostgreSQL, Redis, or SQLite accessed by one process). Running two instances simultaneously will cause split-brain session state and potential write conflicts even with atomic renames, because atomic renames are only safe within one OS process.
