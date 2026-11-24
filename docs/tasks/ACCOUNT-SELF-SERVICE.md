# ACCOUNT-SELF-SERVICE: change my password, change names

24.11.2026. Alon's requests via the project manager. No migrations, services, costs or dependencies (D31).

## Changed
- **Own password, every role** ("החלפת סיסמה" in "החשבון שלי" on the More screen, phone and desktop; the desktop header name links there). Form: current, new, confirm. `features/account/logic/commands.ts` `changeOwnPassword`: identity from the server context (input has no user id); checks the current password with the auth client (`signInWithPassword`, then closes that temporary session); sets the new one with `auth.admin.updateUserById`; then `auth.admin.signOut(token, 'others')` signs out every other session of the person. New password follows the creation rule (8+ chars) and must differ from the current one. Wrong current password, rate limit, and provider errors map to Hebrew; passwords are never logged or returned.
- **Other sessions:** `revoke_user_sessions` is owner-only and ends ALL sessions including the current one, so it is not used. The native 'others' scope is used instead: refresh tokens of other devices stop at once; an access token already issued stays valid until it expires (about an hour at most). If revocation fails the password still changes and the toast says to sign out of other devices by hand. `sessions_valid_after` is not touched.
- **Names:** an admin edits anyone's name in the person sheet ("עריכת שם", existing `updateUser` = `prepare_profile_update` with the same email, revision checked). An admin edits their own name on the account card. Header, lists and `get_actor` read the profile's current name (refresh after save). Diary entries keep their `reporter_name` snapshot, so history shows who it was at the time.
- **Own name for non-owners is NOT available:** `prepare_profile_update` and `update_profile` start with `require_owner`. It needs a new database function (`update_own_name`, proposed text sent to the project manager). Until then the button is hidden for non-owners (`NON_OWNER_CAN_EDIT_OWN_NAME = false` in `account/shared/view-model.ts`) and the server action refuses them (FORBIDDEN) before any call. When the function exists, flip the flag and route `changeOwnName` to it.

## Checked
- tsc and eslint clean. Vitest (quiet): `tests/logic/account` (new: password success/wrong current/rate limit/short/unchanged/extra fields/revocation failure/provider error; name owner/non-owner/validation), `tests/screens/account`, `tests/screens/users`, `tests/screens/ui`, `tests/screens/shell`, `tests/security/static` pass.
- Refusals: a non-owner cannot reach name editing of others (`updateUser` is `ownerOperation`, existing tests) nor own-name editing (new test). A password change can only target the signed-in person because the id is never taken from input.

## Not checked
- Real browser pass at 360 to 1280; no signed-in session here. No cloud tests (need Alon's yes; the production DB must not get test accounts). So the real `signOut(token, 'others')` behaviour and the `updateUserById` call were exercised only with mocks.

## Open
- Migration for `update_own_name` (project manager).
- Header still shows "מנהל מערכת" for owners (see OWNERS-UI).
