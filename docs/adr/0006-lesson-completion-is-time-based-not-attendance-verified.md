# Lesson completion is driven by elapsed time, not verified attendance

`Lesson.status` has always included `'completed'` alongside `'upcoming'` and `'cancelled'`, and the frontend already rendered a distinct badge for it — but nothing ever set it. A Lesson just sat at `'upcoming'` forever once its scheduled time passed, with the Lessons screen's Upcoming/Previous split relying on `startTime` alone rather than status.

The options were: verify attendance via a video-provider webhook/API, require a manual "mark complete" action from the Buddy, or complete Lessons automatically once their time has elapsed.

Verifying attendance is not available to us. Per ADR 0002, video calls happen on a Buddy's static, personal Zoom link that the platform never generates or connects to via API — there is no meeting object on any provider's side that the backend could subscribe to for a "call ended" or "both parties joined" signal. A manual "mark complete" button was considered but rejected for the MVP: it adds a persistent Buddy-side chore with no product benefit over the automatic option, and a Lesson a Buddy forgets to mark stays stuck as "upcoming" indefinitely — worse than the status quo it would replace.

We chose **automatic completion once `startTime + durationMinutes` has passed**, checked by a sweep timer (`services/lessonCompletion.ts`) mirroring the existing pre-lesson reminder sweep (`services/lessonReminders.ts`): same atomic per-Lesson claim via `findOneAndUpdate` so overlapping sweeps can't double-process, same sweep-timer wiring in `server.ts`. No signal ever confirms the Lesson actually happened — a no-show completes exactly like an attended Lesson — but that limitation is inherent to the static-Zoom-link model, not something this decision could have avoided.

Consequence: a Lesson always resolves to `'completed'` or `'cancelled'` within a minute of ending; nothing needs a distinct "attended" concept. If the product later needs a genuine no-show signal, it will have to come from a party self-reporting it (e.g. a Buddy or User flagging the other side didn't show), not from the video platform.
