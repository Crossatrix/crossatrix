## Goal

Make `/functions/v1/croins` accept every request — no JWT check, no expiration errors. Any caller (browser, expired session, external script, curl) can read or change any wallet.

## Changes

**`supabase/functions/croins/index.ts`**
- Delete the `Authorization` header check, the `userClient` creation, and the `getClaims` call.
- Keep CORS, the OPTIONS preflight, and JSON body parsing.
- Keep input validation: require `action` + `user_id`; require positive numeric `amount` for `credit`/`debit`; reject unknown actions.
- Keep wallet upsert + balance update + `croin_transactions` insert using the service-role client.
- Redeploy the function.

No frontend changes — `BugReportsPage` and `SendCroins` keep working, just without the 401 path.

## Security warning (please read)

After this change, anyone who knows the function URL can:
- Read any user's balance (`action: "balance"`)
- Credit any user any amount (`action: "credit"`) — i.e. mint Croins for free
- Debit any user (`action: "debit"`) — i.e. drain wallets

The function URL is effectively public (it appears in browser network requests on `crossatrix.lovable.app`), so this is exploitable by anyone who opens devtools. The Croins economy, the market price, and `send-croins` (which presumably calls this) all become untrusted.

If you'd rather keep it open to your own app but block randos, the safer alternatives are:
1. **Shared API key** in an `x-api-key` header (we removed this earlier — could re-add).
2. **Auto-refresh JWT on the client** before every call (one helper, ~10 lines, fixes the 401s without opening the function).

Confirm you want the fully-open version and I'll implement it.
