/**
 * Single source of truth for staged-rollout flags.
 *
 * Flip these when ready — see comments per flag for the prerequisite
 * panel/database setup needed before each flag can safely be `true`.
 */

/**
 * Gate the app behind a Supabase Auth login (SignInView).
 *
 * Activated on 2026-05-14 after:
 *   ✓ 4 device users created in Supabase Auth
 *     (device-ganxo / device-pista / device-esquitx / device-admin)
 *   ✓ app_metadata.biz_ids set on each user
 *   ✓ scripts/combined-rls-migration.sql executed → 11 tenant_*
 *     policies replace the previous allow_all_* ones
 *   ✓ verified via REST: anon sees 0 rows, ganxo user can only
 *     read/write rows with biz_id='ganxo'
 *
 * Combined with the PIN gate, the app now has two-layer protection:
 *   • Supabase Auth (cryptographic, remote)
 *   • PIN (local, device-level)
 */
export const SUPABASE_AUTH_ENABLED = true;
