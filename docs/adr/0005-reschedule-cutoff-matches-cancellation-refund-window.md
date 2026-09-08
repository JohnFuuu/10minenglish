# Rescheduling a Lesson is allowed only outside the same 12-hour window that governs cancellation refunds

Epic Story 33 says a User can edit or cancel an upcoming Lesson, but nothing in the source spec says how late an edit may happen. Cancellation has an explicit rule — refund at 12 hours or more, no refund inside that — while rescheduling had none, so it needed one.

The options were: allow a move any time before the Lesson starts, allow it up to some independent cutoff, or reuse the existing 12-hour line.

We chose to **reuse the 12-hour cancellation cutoff**. Two reasons:

- Without it, the no-refund rule is trivially avoidable. A User 2 hours out who cancels loses their Credit; the same User could instead push the Lesson a week into the future and lose nothing, which makes the refund cutoff decorative rather than a rule.
- It leaves the domain with one notion of "reasonable notice" rather than two competing numbers. The 12-hour line already means "inside this, you are committed"; rescheduling is another way of not showing up at the agreed time, so it belongs on the same side of that line.

The cost is a User who genuinely can't make a Lesson 6 hours out has no good option: they can cancel and forfeit the Credit, but they can't move it. We accept that for the MVP because it is exactly the outcome the cancellation rule already prescribes — rescheduling should not be a better deal than cancelling for the same lateness.

Consequence: `PATCH /api/lessons/:id` rejects a move inside 12 hours, and the Lessons screen hides the reschedule action there rather than offering an action that will fail. Both read the cutoff from the same constant as the refund rule, so the two cannot drift apart.
