# Payments support two independent providers: Stripe (card) and POLi (NZ bank transfer)

The source flow spec names Stripe as the only payment processor. Product direction (NZ-based) wanted POLi added as a bank-transfer option. Research during the walkthrough found POLi is not a Stripe-supported payment method — it has always been its own independent gateway/API, historically separate from card processors. This meant three real options: run Stripe and POLi as two independent integrations, drop Stripe for POLi-only, or defer POLi as a fast-follow.

We chose to run **both as independent integrations**, each with its own callback/webhook wiring, unified only at the domain level: a Payment (see `CONTEXT.md`) is provider-agnostic and either succeeds (grants Credits) or fails, regardless of which provider processed it. Dropping Stripe was rejected because it would cut off all non-NZ card payments; deferring was considered but not chosen since POLi support was explicitly requested for this pass.

POLi is only shown as a payment option to Users whose Location is New Zealand (using the existing signup field) — it requires an NZ bank account, so showing it elsewhere is a guaranteed-fail path. This is an approximation (an NZ citizen abroad, or a foreign resident with an NZ account, are edge cases not handled), accepted as good-enough for a first cut.

Consequence: the app now maintains two independent payment integrations (two webhook handlers, two failure-mode sets, two reconciliation paths) rather than one — a real ongoing maintenance cost accepted in exchange for NZ bank-transfer support.
