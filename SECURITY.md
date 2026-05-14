# Security Posture — NCR Reserves

_Last update: 2026-05-14 — Lead Security Engineer review + full Auth/RLS deploy_

This document captures the security state of the app.

---

## ✅ Currently shipped (production)

### Transport / hosting
| Area | Implementation | File |
|---|---|---|
| Production server | Custom zero-dep Node static server with strict headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP) — replaces `vite preview` | `server.mjs` |
| Start command | `npm run start` → `node server.mjs` | `package.json` |
| DNS rebinding | Removed permissive `'all'` from `preview.allowedHosts` | `vite.config.ts` |
| Source maps | Explicitly disabled for production builds | `vite.config.ts` |
| Path traversal | Resolver in `server.mjs` refuses paths outside `dist/` | `server.mjs` |
| MIME sniffing | Whitelist in `server.mjs`; unknown extensions → 404 | `server.mjs` |
| Method safety | Only `GET` / `HEAD` accepted | `server.mjs` |

### Authentication (two-layer)

**Layer 1 — Supabase Auth (remote, cryptographic):**
| Item | Status |
|---|---|
| 4 device users with strong passwords | ✅ Created |
| `app_metadata.biz_ids` per user (server-controlled, not user-editable) | ✅ Stamped |
| Session persists across reloads, auto-refresh | ✅ `persistSession: true` |
| `detectSessionInUrl: false` (no URL session injection) | ✅ |
| Namespaced storage key | ✅ `ncr-reserves-auth` |
| Migrated to new `sb_publishable_*` keys (post-JWT system) | ✅ 2026-05-14 |
| Legacy JWT-based anon + service_role keys | ✅ Disabled |

**Layer 2 — PIN gate (local, per-device):**
| Item | Status |
|---|---|
| PBKDF2-SHA256 / 100k iters / per-PIN salt | ✅ |
| Constant-time verification across all entries | ✅ |
| 4 PINs baked into source (1 per venue + admin) | ✅ |
| Scope intersection with Supabase session `biz_ids` | ✅ |
| No lockouts / no attempt counters (UX-first) | ✅ |
| "Blocar" buttons (sidebar + Més) return to PIN screen | ✅ |
| `useVisibleBusinesses()` hides locked venues from every list | ✅ |

### Row-Level Security (Supabase)
| Table | Policy | Restricted to |
|---|---|---|
| `reservations` | tenant_reservations_* | `biz_id = ANY(auth_biz_ids())` |
| `customers` | tenant_customers_* | `biz` jsonb array ∩ `auth_biz_ids()` ≠ ∅ |
| `floor_plans` | tenant_floor_plans | `biz_id = ANY(auth_biz_ids())` |
| `shift_notes` | tenant_shift_notes | `biz_id = ANY(auth_biz_ids())` |
| `app_events` | tenant_app_events | `biz_id = ANY(auth_biz_ids())` |
| `biz_settings` | tenant_biz_settings | `biz_id = ANY(auth_biz_ids())` |
| `employees` | tenant_employees | `biz_id = ANY(auth_biz_ids())` |
| `employee_roles` | tenant_employee_roles | `biz_id = ANY(auth_biz_ids())` |
| `employee_shifts` | tenant_employee_shifts | `business_id = ANY(auth_biz_ids())` |

All policies are restricted to the `authenticated` role.
The `anon` role has **no** policies — i.e. zero access.

**Verified empirically:**
- `anon` SELECT → 0 rows
- `anon` POST → 401
- `device-ganxo` SELECT → only `biz_id='ganxo'`
- `device-ganxo` POST `biz_id='pista'` → 403 (cross-tenant injection blocked)
- `device-admin` SELECT → all 121 reservations

### Input validation (defence in depth)
| Layer | Implementation | File |
|---|---|---|
| Store mutators | Every `add*`/`update*` runs through a domain sanitiser (clamp length, strip control chars, type-coerce, regex-validate dates/times) | `src/utils/validation.ts` + `src/store/useAppStore.ts` |
| UI forms | `maxLength`, `pattern`, `inputMode`, `autoComplete` on every input | Reservation, Client, Walk-in, Notes, Events, Reservation edit panel |
| Phone | Allow-list `[+0-9 ()\-\. ]`, cap 30 chars | ✅ |
| Email | Trim + lowercase, cap 254 | ✅ |
| Pax | Integer clamped `[1, 200]` | ✅ |
| Date / Time | Regex-validated against `YYYY-MM-DD` / `HH:MM`, with fallback | ✅ |

### Information hygiene
| Area | Implementation |
|---|---|
| Logging | `safeLog` wrapper silences `console.log/warn/info` in production builds |
| `.gitignore` | `.env.local`, `scripts/setup-supabase-auth.mjs`, `.supabase-tmp/` |
| `npm audit` | 0 vulnerabilities (28 prod + 178 dev deps) |
| XSS surface | 0 `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write` |

---

## 📊 Security score

| Layer | Before audit | Current |
|---|---|---|
| Transport (TLS / HSTS) | C | **A** |
| HTTP headers | F | **A** |
| Frontend (XSS surface) | B | **A** |
| Authentication | F | **A-** |
| Authorization (RLS) | F | **A-** |
| Input validation | F | **A** |
| Data at rest (localStorage) | D | **C** |
| Dependencies | A | **A** |
| Logging hygiene | C | **A-** |

**Overall: A-** ✅
Previously: D (anon could dump the entire DB, no auth, no headers, no validation).

---

## 🟡 Remaining (nice-to-have)

| # | Item | Why |
|---|---|---|
| 1 | Encrypt the persisted `useAppStore` blob in localStorage | Currently plaintext PII (phones/emails/notes). Mitigation: WebCrypto + PBKDF2 derived from the in-shift PIN. |
| 2 | Self-host Google Fonts | RGPD: each visitor's IP/UA currently leaks to `fonts.googleapis.com`. Self-hosting removes the third-party dependency. |
| 3 | Add `npm audit --audit-level=high` to the CI build step | Block deploys if a vulnerable dep slips in. |
| 4 | Pin dep versions (drop `^`) | Eliminate transitive surprises between deploys. |
| 5 | Sign local backups with HMAC-SHA256 | A tampered backup can't be restored if signature doesn't verify. |
| 6 | Edge Function rate-limits on Supabase Auth | Brute-force protection on the login endpoint. |

---

## 🔐 Operational hygiene

- **Device passwords**: 4 strong random passwords (19 chars, ~107 bits entropy) — owner has them in their secure password store.
- **PINs**: baked hashes in `src/lib/pinAuth.ts`; the plain PINs only exist in the owner's head + this app's setup.
- **Supabase keys**: legacy disabled. Only `sb_publishable_*` (safe to ship in browser) is in env. No secret key is used by the app itself.
- **One-off scripts**: `scripts/setup-supabase-auth.mjs` is `.gitignore`d to prevent accidental commit of plaintext passwords; users were re-created idempotently.

---

## 📜 Migration timeline

- **2026-05-14 — Audit start**: D-grade. RLS `allow_all_*`, no auth, no headers.
- **2026-05-14 — Hardening pass 1**: server.mjs + CSP + safeLog + sourcemap off.
- **2026-05-14 — PIN gate**: PBKDF2 + setup/lock screens + scope filter.
- **2026-05-14 — Validation pass**: domain sanitisers + form attributes.
- **2026-05-14 — Auth pass**: 4 device users + `app_metadata.biz_ids` + RLS rewritten.
- **2026-05-14 — Key migration**: legacy JWT keys disabled, `sb_publishable_*` in use.
- **Status**: A- grade. Production-ready for real customer data.
