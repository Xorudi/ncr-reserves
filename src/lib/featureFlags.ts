/**
 * Single source of truth for staged-rollout flags.
 *
 * Flip these when ready — see comments per flag for the prerequisite
 * panel/database setup needed before each flag can safely be `true`.
 */

/**
 * Gate the app behind a Supabase Auth login (SignInView).
 *
 * Prereqs before flipping to `true`:
 *   1. Create one Supabase Auth user per device/venue in the dashboard.
 *   2. Set `app_metadata.biz_ids` for each user.
 *   3. Run `supabase/auth-migration.sql` to enable tenant-scoped RLS.
 *
 * Until those are in place, leave this `false`. The PIN gate alone is
 * enforced, and Supabase requests still work because RLS is `allow_all`.
 */
export const SUPABASE_AUTH_ENABLED = false;
