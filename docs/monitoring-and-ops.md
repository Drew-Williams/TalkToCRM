# Monitoring Corner — a lightweight ops/CSM setup

No new dashboard was built for this — everything below either already
exists (four different tools already collecting exactly this data) or is
a handful of SQL views on top of the existing schema
(`supabase/migrations/20260831130000_ops_views.sql` and
`20260831130100_ops_views_trial_accuracy.sql`). Query the views directly
in the [Supabase SQL Editor](https://supabase.com/dashboard/project/ziccpxpvrgbsjybjhzhv/sql/new)
— that editor runs as the `postgres` role, which bypasses RLS, so they
just work there with no extra login or API key needed. They are
deliberately **not** reachable by the extension itself or by any signed-in
rep's own session (every one of them is cross-user by design).

## The one query for "how's Corner doing right now"

```sql
select * from public.ops_funnel_summary;
```

Returns a single row: total accounts, how many connected a CRM, how many
completed a first call, how many are still actively trialing, how many
let their trial lapse without converting, and paid/past-due/canceled
counts. This is the whole top-of-funnel-to-revenue story in one query.

## Who to actually reach out to

```sql
-- Still time to save these — trial genuinely hasn't ended yet, soonest first
select * from public.ops_trial_watchlist;

-- Trial already lapsed without converting — reactivation candidates
select * from public.ops_lapsed_trials;
```

Both flag whether the rep ever connected a CRM and ever completed a call
— a lapsed trial that never connected a CRM at all is a very different
conversation than one that connected, talked to Corner five times, and
still didn't pay.

Note: `subscriptions.status` never flips itself away from `'trialing'` the
moment a trial's `trial_end` passes — nothing server-side updates it until
Stripe becomes involved at checkout (see `useSubscription.ts`'s
`isActive`, which checks `trial_end` against `now()` client-side). That's
why `ops_trial_watchlist`/`ops_lapsed_trials` both filter on `trial_end`
directly rather than trusting `status` alone — discovered by running the
first version of `ops_funnel_summary` against real data and seeing
"30 currently trialing" when more than half had already lapsed weeks
earlier.

## A specific account

```sql
select * from public.ops_account_overview where email = 'someone@company.com';
-- or, if they never linked an email (anonymous accounts have none):
select * from public.ops_account_overview where user_id = '...';
```

One row: signup date, anonymous vs. identified, profile info, connected
CRM(s), subscription status/trial_end, and total/first/last call
timestamps.

## Usage trend over time

```sql
select * from public.ops_daily_signups order by day desc limit 30;
select * from public.ops_daily_calls order by day desc limit 30;
```

Calls per day is the real usage metric — installs and connections are
necessary but say nothing about whether reps are actually talking to
Corner.

## Errors — no new tooling, use what Supabase already gives you

Every edge function logs errors with a consistent `[function-name]`
prefix (e.g. `[crm-proxy]`, `[stripe-webhook]`, `[pipedrive-oauth-exchange]`)
already. Two ways to see them:

1. **Per-function logs**: [Supabase Dashboard → Edge Functions](https://supabase.com/dashboard/project/ziccpxpvrgbsjybjhzhv/functions) → click a
   function → **Logs** tab. Good for "is `crm-proxy` erroring right now."
2. **Cross-function log explorer**: [Dashboard → Logs → Edge Functions](https://supabase.com/dashboard/project/ziccpxpvrgbsjybjhzhv/logs/edge-functions) —
   supports a query language; filter with something like
   `event_message like '%error%'` to see every function's errors in one
   place, ordered by time.

There's no alerting wired up (no Slack/email ping on a spike) — this is
manual-check-only for now. Worth revisiting once volume is high enough
that checking manually stops being realistic.

## Everything else — already has its own dashboard, nothing to build

- **Chrome Web Store installs/ratings**: [Developer Dashboard](https://chrome.google.com/webstore/devconsole) → the item → **Analytics**/**Store listing** tabs (the installs chart you're already looking at).
- **Revenue, MRR, churn, failed payments**: [Stripe Dashboard](https://dashboard.stripe.com) — this already computes all of this natively; no need to duplicate it in Supabase.
- **Call quality / transcripts / cost per conversation**: [ElevenLabs Dashboard](https://elevenlabs.io/app/conversational-ai) → the Corner agent → **Conversation history** — every call's full transcript, duration, and cost are already there per-conversation, which is a better place to spot-check coaching quality than anything in Supabase.

## Suggested weekly rhythm

1. `select * from public.ops_funnel_summary;` — the headline numbers.
2. `select * from public.ops_trial_watchlist;` — anyone worth a personal nudge before their trial ends.
3. Skim the Chrome Web Store install trend and any new reviews.
4. Skim Stripe for any failed payments or new subscribers.
5. Spot-check 1–2 recent ElevenLabs conversation transcripts for coaching quality.
