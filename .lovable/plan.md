# Settings & 2-Step Authentication

Add a Settings button on the Dashboard that opens a `/settings` page. From there, the user can change their password and enable/disable 2-Step Authentication using one of four methods.

## 1. Settings entry point

- Add a gear icon `Button` next to "Sign Out" in `src/pages/Dashboard.tsx` header → navigates to `/settings`.
- New route `/settings` → `SettingsPage.tsx` (registered in `src/App.tsx`).

## 2. Settings page layout

Vault-styled card with sections:
- **Account** → "Change Password" button → `navigate("/reset-password")` after triggering `supabase.auth.resetPasswordForEmail(user.email)` so the recovery link works (or just redirect if already signed in and let the existing reset flow handle it).
- **2-Step Authentication** → shows current method (or "Disabled"), with a "Configure" button opening a method picker:
  1. Email (Mailjet)
  2. SMS (seven.io)
  3. Account File (`Account.crossauth`)
  4. Face Scan

Only one method active at a time (can switch).

## 3. Database

New table `user_2fa`:
- `user_id` (uuid, unique, references auth user)
- `method` ('email' | 'sms' | 'file' | 'face' | null)
- `phone` (text, nullable — for SMS)
- `secret_key` (text, nullable — for file method, random 32-byte hex)
- `face_descriptor` (jsonb, nullable — face-api.js 128-float vector)
- `enabled` (bool)
- `created_at`, `updated_at`

New table `user_2fa_challenges` (short-lived OTP store):
- `user_id`, `code_hash`, `method`, `expires_at`, `consumed`

RLS: users can read/update only their own row. Service role writes challenges.

## 4. Edge functions

All use `verify_jwt = false` + manual JWT validation via `auth.getClaims` (case-insensitive Authorization header), permissive CORS — matches existing ecosystem pattern.

- **`twofa-setup`** — start enrollment. Body: `{ method, phone? }`. For email/sms: generates 6-digit code, stores hash in `user_2fa_challenges`, sends via Mailjet/seven.io. For file: generates `secret_key`, returns it once so the client can download `Account.crossauth`. For face: returns OK; client posts descriptor in step 2.
- **`twofa-verify-setup`** — confirms enrollment. Body: `{ method, code? | secret_key? | face_descriptor? }`. On success, writes/updates `user_2fa` with `enabled=true`.
- **`twofa-challenge`** — request a verification (used at sign-in or sensitive action). Sends OTP for email/sms; returns nonce for file/face.
- **`twofa-verify`** — verifies the response (code, file secret, or face descriptor distance ≤ 0.5).
- **`twofa-disable`** — turns it off after a successful verify.

Mailjet uses `MAILJET_KEY` + `MAILJET_SECRET` (already in secrets). seven.io uses `SEVENOI_KEY` (already in secrets).

## 5. Frontend components

- `src/pages/SettingsPage.tsx` — sections + status.
- `src/components/TwoFactorSetup.tsx` — modal/sheet driving the 4-method flow:
  - **Email**: confirm email → send code → enter code → enable.
  - **SMS**: enter phone (E.164) → send code → enter code → enable.
  - **File**: generate key → download `Account.crossauth` (JSON: `{ user_id, secret_key, created_at }`) → confirm by re-uploading → enable.
  - **Face**: load `face-api.js` (tiny face detector + face recognition models from CDN), capture webcam frame, compute 128-d descriptor, store → enable.
- `src/components/TwoFactorChallenge.tsx` — reusable verifier (used post-login when 2FA is enabled).

## 6. Login integration

In `AuthPage.tsx`, after successful `signInWithPassword`, check `user_2fa.enabled`. If true, sign the user back out of "active" UI state until they pass `twofa-challenge` + `twofa-verify`. Simpler approach: keep session, but gate `/dashboard` redirect behind a `<TwoFactorChallenge />` step.

## 7. Dependencies

- `face-api.js` for face descriptors (loads models from a CDN; no extra build steps).

## Technical notes

- Codes: 6 digits, 10-min TTL, hashed with SHA-256 before storage.
- File secret: 32 random bytes hex, compared constant-time on verify.
- Face match threshold: Euclidean distance ≤ 0.5 between stored and live descriptor.
- All 2FA edge functions accept the user JWT and resolve `user_id` via `auth.getClaims` — never trust client-supplied user_id.
- `supabase/config.toml` gets new `[functions.twofa-*]` blocks with `verify_jwt = false`.

## Open questions

1. Should 2FA be required at every sign-in once enabled, or only for sensitive actions (sending Croins, admin balance changes)?
2. For SMS, should we restrict to certain country prefixes, or accept any E.164 number?
3. Face Scan: store the descriptor only (recommended, ~1KB, privacy-friendly), or also a reference image? I'll default to descriptor-only unless you want the image too.
