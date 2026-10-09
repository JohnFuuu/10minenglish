# Social sign-in takes back an unconfirmed account instead of joining it

Google and Facebook sign-in link to an existing account with the same email rather than creating a duplicate. That linking also opened account pre-hijacking: someone signs up with another person's email and a password of their own, never confirms it, and waits. When the real owner later signs in with Google or Facebook, they land in that account — marked confirmed — while the squatter's password and 7-day login token still work.

We considered refusing to link (create a second account, or block sign-in until the email-password account is confirmed) and linking only after confirmation by email. Both put friction on the real owner, who is the one person here with proof of the email.

We chose **link, but take the account back when its email was never confirmed**. Google and Facebook only hand over emails they have verified, so the social sign-in is proof of ownership; the earlier registration is not. On that link (`services/accountClaim.ts`) the account's password, pending reset/confirmation links, pending email and lockout are cleared, and `tokensValidAfter` is set so every login token issued before that moment is refused by `requireAuth`. The owner can set their own password in Profile.

An account whose email *was* confirmed is linked as before, untouched: its owner already proved the email, and the provider proves it again.

Consequences: `requireAuth` now reads the account on every request (it previously did only for Buddies and Admins), and `tokensValidAfter` is the general way to end every session of an account should we need it elsewhere. Profile fields the registrant typed (name, picture, onboarding answers) are kept; there is nothing of value in an unconfirmed account — it can't book or buy.
