# Email confirmation gates spending, not login

A password-signup User used to be locked out entirely until they clicked the link in their confirmation email: signup showed "check your inbox", login returned 403 until confirmed, and clicking the link only said "you can now log in", so they had to log in again. Most of the product's Users are older, and every switch between the app and their inbox, plus a second login, is a real drop-off point.

The options were: keep blocking login until confirmed, let Users in but block spending until confirmed, or replace the link with a 6-digit code typed into the app.

We chose **let them in, block spending**, the pattern used by apps like Airbnb and Uber. Signup signs the User straight in, so they can onboard and look around. Booking a Lesson (single or recurring) and starting a Stripe or POLi checkout return `403 EMAIL_NOT_CONFIRMED` until they confirm (`middleware/requireConfirmedEmail.ts`, which reads the flag from the database so it applies as soon as they click, without a fresh token). Clicking the link confirms the address **and signs them in**, because the link often opens in a different browser (the mail app's) from the one they signed up in. Signing up again with an email that is registered but not yet confirmed sends a new link instead of a dead-end "already registered" message.

A code was rejected for now. It avoids the different-browser problem, but typing six digits is harder for this audience than tapping one button, and auto sign-in on the link already covers that problem.

Consequences: unconfirmed User accounts can exist and be signed in, so any new spending action must also apply `requireConfirmedEmail`. Google sign-ups and Admin-provisioned Buddies are created already confirmed, so this never affects them. None of this reaches real people until a real email provider replaces the dev `consoleEmailSender`.
