# Corner — Investor Brief

## What Corner is

Corner is a voice-first AI sales coach that lives inside a rep's browser as a Chrome extension. A rep opens a deal in their CRM, clicks one button, and talks through it out loud with an AI coach that already knows the deal — its stage, value, history, and every prior conversation they've had about it. No chat window, no dashboard to check, no data entry. It's the closest thing to having an experienced sales manager sitting beside every rep, on every call, for a fraction of the cost.

## The problem

Most reps get coached rarely — a handful of deal reviews a quarter, if that — and when they do, it's usually a manager skimming CRM notes cold. The knowledge that would actually help (how to qualify this deal, what's really at risk, what to do next) either doesn't exist, lives in one manager's head, or arrives too late to change the outcome. Meanwhile, existing sales tools are either passive (dashboards, reports) or add friction (more fields to fill in, more UI to learn). Reps don't need another system to update — they need someone to talk to.

## How it works

1. **Connect your CRM** (Pipedrive at launch) via a standard OAuth flow — one click, no manual data entry ever.
2. **Open a deal.** Corner detects it automatically and reads it live, directly from the CRM: stage, value, contacts, and — critically — the actual notes, emails, and call history, not just the surface-level fields.
3. **Talk about it.** A real-time voice conversation, powered by ElevenLabs' conversational AI, coaches the rep through the deal: what's working, what's missing, what to do next. Every claim is grounded in real CRM data — the coach doesn't invent facts.
4. **The coach remembers.** After every call, Corner automatically distills what was discussed, the biggest risk identified, and the agreed next step — and brings that context into the *next* conversation about the same deal, so it never starts from zero.

## What's been built

- **Full CRM integration layer**: OAuth connect flow, live deal reads, and activity history — architected to support multiple CRMs (Pipedrive live now, HubSpot fully built and ready to re-enable).
- **A real-time voice coaching engine**: a custom-tuned AI coaching persona (not a generic chatbot) running our own proprietary deal-diagnosis framework — the **Seven Alignment Gaps** (Problem, Stakeholders, Process, Value, Risk, Timing, Decision) — grounded strictly in real deal data, running over live voice. Not a licensed third-party methodology; see `docs/corner-methodology.md` for the full explanation and language to use with prospects/investors.
- **Persistent coaching memory**: the product's core differentiator — the coach has continuity across conversations, the same way a human manager who's followed a deal for weeks does, without a rep having to repeat themselves.
- **Personalization**: the coach knows each rep by name and role, and a lightweight AI-generated company profile (value proposition, ideal customer, industry, competitors) so its coaching is calibrated to the business it's coaching for — inferred automatically from a company's own website.
- **A frictionless growth funnel**: install-first, no landing page sign-up, no credit card upfront. A 7-day free trial starts the moment someone opens the extension; payment is only requested once value has already been delivered. This is a deliberate product-led-growth design choice to maximize the number of people who actually experience the product before being asked to pay.
- **Production billing infrastructure**: Stripe-integrated subscription billing ($19/month), fully wired end-to-end from trial to paid conversion.

## Where it stands today

The MVP is live and functional, currently scoped to Pipedrive customers to sharpen initial focus. The product is in active internal testing ahead of a Chrome Web Store launch. The architecture is CRM-agnostic by design — expanding to HubSpot (already built) and additional CRMs is a configuration decision, not a rebuild.

## Why this is defensible

The obvious version of this product is a chatbot bolted onto a CRM. Corner is deliberately not that: it's voice-first (how sales conversations actually happen), it remembers (compounding value the longer a rep uses it), and it's grounded entirely in real data rather than generic advice. The install-first, pay-later funnel also means the cost of trying Corner is close to zero — the product has to earn the subscription by being genuinely useful in the first week, which is a higher bar than most sales tools clear, and a stronger, more durable growth loop once it does.
