# Security Posture — NCR Reserves

_Last audit: 2026-05-14 — Lead Security Engineer review_

This document captures the security state of the app and the action plan
for the items that **cannot** be safely auto-applied without architectural
changes.

---

## ✅ Hardening already applied (this audit)

| Area | Change | File |
|---|---|---|
| Production server | Replaced `vite preview` with a custom static server enforcing CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP | `server.mjs` |
| Start command | `npm run start` now boots `node server.mjs` | `package.json` |
| DNS rebinding | Removed `'all'` from `preview.allowedHosts` | `vite.config.ts` |
| Source maps | Explicitly disabled for production builds | `vite.config.ts` |
| Info disclosure | `safeLog` wrapper silences `console.log/warn/info` in production | `src/utils/safeLog.ts` |
| Directory traversal | Path-normalised resolver in `server.mjs` refuses anything outside `dist/` | `server.mjs` |
| MIME sniffing | `server.mjs` enforces a whitelist; unknown extensions return 404 | `server.mjs` |

### Verified safe (no change needed)

- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write`.
- `npm audit` reports 0 vulnerabilities across 28 prod + 178 dev deps.
- `.env.local` is `.gitignore`d and not tracked.
- No `target="_blank"` links without proper rel.
- No Electron / NodeIntegration surface (this is a pure web app + PWA).

---

## 🔴 CRITICAL — must be fixed before production with real customer data

These two findings are architectural. **Auto-applying them would break the app**;
they need a planned migration.

### 1. Supabase RLS policies are `allow_all`

**File:** `supabase/schema.sql:147-167`

The anon key is **public by design** (it ships in the JS bundle — that is
Vite + Supabase's intended model). Security relies entirely on Row-Level
Security policies. Currently every table has:

```sql
create policy "allow_all_*" on <table> for all using (true) with check (true);
```

Anyone with the anon key (i.e. anyone who visits the site) can:

- `SELECT *` from every table → full PII dump
- `DELETE` / `UPDATE` any row → sabotage
- `INSERT` arbitrary garbage → DoS / poisoning

**Action plan (recommended phasing):**

1. **Enable Supabase Auth** (email+OTP or magic link) for staff.
2. Replace `allow_all_*` policies with tenant-scoped ones, e.g.:
   ```sql
   create policy "tenant_read_reservations"
     on reservations for select
     using (
       biz_id in (
         select biz_id from employees
         where auth_user_id = auth.uid() and active = true
       )
     );
   ```
3. Repeat for `customers`, `floor_plans`, `shift_notes`, etc.
4. Add a `employees.auth_user_id uuid` column linking each staff row to its
   Supabase Auth user.
5. Front-end: route through `supabase.auth.signInWithOtp(...)` instead of
   the current decorative PIN screen.

**Risk of NOT fixing:** total data breach is trivially reproducible by anyone
who opens DevTools.

### 2. PIN "login" performs no authentication

**File:** `src/views/desktop/LoginView.tsx:75-79`

The PIN is never validated. `onLogin(selected)` fires regardless of the
4-digit value. The session has no signed token, no expiration, and is
restored from `localStorage` on every reload.

**Action plan:**

- Tie the login flow to Supabase Auth (above). Replace the PIN screen with
  a real password / magic-link flow; the PIN can survive as a *secondary*
  in-shift check by storing a per-employee bcrypt/argon2 hash server-side
  and verifying via an RPC, but never as the only credential.
- Set `auth.persistSession: true` on the Supabase client once Auth is in
  place (currently `false`) so the session lives in a controlled storage
  with expiry rather than raw `localStorage` app state.

---

## 🟠 Recommended (medium-term)

| # | Area | Recommendation | Why not auto-applied |
|---|---|---|---|
| 1 | Local data | Encrypt the `useAppStore` persisted blob with a user-derived key (WebCrypto + PBKDF2 of the login secret) | Breaks existing backups; needs a migration path |
| 2 | Form inputs | Add `maxLength` (e.g. name 80, phone 30, email 120, notes 1000) + format `pattern` to every `<input>` in Reservation/Client/Note forms | Touches many UI files; user requested no UI changes without need |
| 3 | Google Fonts | Self-host Inter/Fraunces/JetBrains Mono in `public/fonts/` and drop the `fonts.googleapis.com` `<link>` | Tiny visual risk if subsetting differs |
| 4 | Backup integrity | Sign local backups with HMAC-SHA256 before storing in IndexedDB so a tampered backup can't be restored | Breaks existing un-signed backups |
| 5 | Rate limiting | When real auth lands, add Supabase Edge Function rate-limits on auth + write endpoints (10/min/IP per route) | Requires backend |
| 6 | CI/CD | Add `npm audit --audit-level=high` to the Railway build step so a vulnerable dep blocks deploy | Build pipeline change |
| 7 | Dependency pinning | Switch `^x.y.z` to exact pins in `package.json` for prod deps; let dependabot raise PRs | Workflow change |

---

## 🟡 Compatibility risks to verify after this audit

| Change | Risk | Mitigation |
|---|---|---|
| `server.mjs` replaces `vite preview` | If `dist/` is empty on Railway, server 404s everything | Railway's NIXPACKS auto-runs `npm run build` because `build` script exists. Verify the first deploy log shows the build step. |
| Strict CSP | Any future inline `<script>` tag in `index.html` will be blocked | Add a nonce strategy if inline scripts ever become necessary |
| `connect-src` allow-list | Adding a new third-party API requires updating CSP in `server.mjs` | Documented above |
| `frame-ancestors 'none'` | The app can no longer be embedded in an `<iframe>` | Intended — clickjacking defence |
| `style-src 'unsafe-inline'` | Kept because React inline `style={{}}` attributes need it | Acceptable trade-off; the bigger XSS vectors are blocked elsewhere |

---

## 🎯 Pre-production checklist

- [ ] Replace Supabase RLS `allow_all` policies with tenant-scoped policies
- [ ] Implement real authentication (Supabase Auth or equivalent)
- [ ] Add `auth_user_id` column on `employees` and backfill
- [ ] Rotate the Supabase anon key after the auth migration
- [ ] Configure Railway to enforce HTTPS (Force HTTPS toggle ON)
- [ ] Verify `Strict-Transport-Security` header lands on the live domain
- [ ] Run `npm run build && node server.mjs` locally and open DevTools → Network → verify CSP/HSTS/X-Frame-Options/etc. are present on every response
- [ ] Add `maxLength`/`pattern` validators to Reservation + Client forms
- [ ] Self-host fonts
- [ ] Set up a daily DB backup with point-in-time recovery in Supabase
- [ ] Document the data retention / RGPD policy for customer records
- [ ] Add an "Esborrar les meves dades" RGPD flow for customers on request

---

## 📊 Security score

| Layer | Before | After this audit | After full plan |
|---|---|---|---|
| Transport (TLS/HSTS) | C | A | A |
| HTTP headers | F | A | A |
| Frontend (XSS surface) | B | A- | A |
| Authentication | F | F | A- |
| Authorization (RLS) | F | F | A- |
| Data at rest | D | D | B |
| Dependencies | A | A | A |
| Logging hygiene | C | B+ | A |

**Current overall: D**  → after this audit's auto-fixes: **C+**
→ after critical items resolved: **A-**.

The big jump is gated on the two architectural fixes above. Until they
land, treat the production deploy as **demo/staging only** — do not load
real customer PII into Supabase.
