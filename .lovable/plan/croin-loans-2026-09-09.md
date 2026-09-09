# Croin Loans

Let users borrow Croins and pay them back in instalments, with escalating consequences for missed payments and an admin panel to unlock and review appeals.

## Borrowing

- Anyone signed in can take a loan at any time.
- Up to 3 active loans at once, and at most 30,000 Croins of outstanding debt across all of them together.
- A one-time 5% fee is added when the loan is taken: borrow 10,000 and you owe 10,500.
- When taking a loan the user picks a schedule:
  - Weekly: pay at least 2% of the original total each week.
  - Monthly: pay at least 5% of the original total each month.
- The borrowed amount lands in the wallet immediately and shows in the transaction history.

## Repaying

- When an instalment falls due it is charged automatically from the wallet if the balance covers it.
- A "Pay now" button lets users pay early, pay extra, or clear the whole loan at once.
- A loan closes automatically once the balance reaches zero.

## Missed payments

A payment is missed when it is due and the wallet cannot cover it.

- 1 miss: warning shown on the dashboard and in the loan panel.
- 2 misses: Croin transfers and the Croin API are locked for that account until the overdue amount is paid. Everything else keeps working.
- 3 misses: the account is locked (same lockdown behaviour as today) and can only be reopened by an admin.
- Paying off the overdue amount clears a level-2 lock straight away. A level-3 lock always needs an admin.

## Appeals

- A locked user sees a form to write a message to support.
- Admins (moritz.loeseke7@gmail.com, cross.a.trix.owner@hotmail.com) get a panel listing appeals with the user's loans and miss count, and can reply, unlock the account, or forgive/reset misses.

## Where it lives

- New "Loans" section in the dashboard wallet area: current debt, active loans, next due date, amount due, pay button, and a form to take a new loan.
- New admin page for appeals and unlocks, reachable from settings for the two admin accounts.

## Technical notes

- Tables: `loans` (principal, total owed, remaining, schedule week/month, instalment amount, next_due_at, status), `loan_payments` (history), `loan_appeals` (message, status, admin reply), and a `loan_penalties` record per user (miss count, lock level, cleared_at).
- Borrowing, paying, and penalty escalation run in security-definer SQL functions with row locking, mirroring `transfer_croins` and `trade_share`, so balances can't race.
- A due-date sweep function marks overdue instalments, attempts auto-charge, and escalates miss count; it runs on demand when the dashboard or any loan-related edge function is hit (no cron needed), so consequences apply the moment a user or the API touches the system.
- Edge functions `loan-take`, `loan-pay`, `loan-appeal`, `loan-admin` (verify_jwt=false, JWT validated in code, killswitch + lockdown checks like existing functions).
- Level-2 lock is checked in `send-croins` and `croins` (return 423 with a `loan_overdue` code); level-3 writes to the existing `account_lockdowns` table so the current lockdown flow handles sign-out and API blocking.
- RLS: users read only their own loans, payments, penalties, and appeals; admins (via `is_owner_email()`) read all; all writes go through the security-definer functions.
