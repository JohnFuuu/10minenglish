# Recurring bookings skip unfillable occurrences rather than failing atomically

The source flow diagram didn't specify what happens when a recurring booking (e.g. 5 weekly sessions with a chosen Buddy) can't find availability for every occurrence. We considered three options: all-or-nothing failure, skip-and-continue, or skip-with-manual-fill-prompt.

We chose **skip-and-continue**: the system books whatever occurrences it can, tells the User which ones failed, and only deducts Credits for Lessons actually booked. All-or-nothing was rejected because a single scheduling conflict shouldn't discard several other valid, wanted Lessons — the point of recurring booking is convenience over a multi-week window, not transactional atomicity.

Note this only applies to *availability* conflicts, which are unpredictable at request time. Credit sufficiency is a separate, fully-known precondition and is checked upfront — a User without enough Credits for the full requested series is blocked before booking starts, not partially filled (see domain glossary: Credit).
