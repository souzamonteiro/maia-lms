# Experience and accessibility

> **Initial MVP status:** this document records requirements for the complete product. The initial MVP delivered free text courses, identity, enrollment, and progress. Video, commerce, quizzes, certificates, MFA, and privacy requests still required implementation at that stage. See [the roadmap](09-roadmap.md) for subsequent deliveries.

Public home: hero promotion, searchable catalog, free courses, recently published, categories, Maia projects and instructor credibility. Course cards distinguish Free, Free with enrollment and Paid. No misleading scarcity or fabricated ratings. Responsive course page presents outcomes, syllabus, prerequisites, duration, level, language, preview, instructor bio, certificate policy and support/refund information.

Learner player: module navigation, resume, adjustable playback speed, captions, transcript, keyboard controls, readable text, downloadable authorized files and progress. Quizzes explain result and remaining attempts without exposing answer keys prematurely. Account area shows courses, receipts, progress, certificates and privacy controls.

Author studio: draft/course wizard, module/lesson reorder, Markdown preview with sanitization, upload status, caption/transcript entry, quiz builder, price and landing-page editor, preview as visitor/learner, submit/publish audit. Admin merchandising controls schedule featured slots and record editor changes.

Target WCAG 2.2 AA for key journeys. Test keyboard-only navigation, visible focus, semantic headings, contrast, responsive zoom, screen reader labels, error announcements and captioned playback. Offer Portuguese (Brazil) first and English-ready localization keys; course locale can differ from UI locale. Avoid baked-in text on images; require alt text and transcript/caption workflows for publishing video.

## Implemented catalog browsing

The catalog shows 12 published courses per page. Visitors can combine title/summary
search with course language, level, and access type, and sort by newest or title.
Previous/next links preserve filters; submitting a search resets to page one.
**Clear filters** returns to the unfiltered catalog. No matching courses produces
an explicit empty state, with filters still available for correction.

URLs preserve the selection, for example
`/courses?q=Python&locale=en&level=beginner&accessMode=OPEN_FREE&sort=title&page=2`.
Reload and browser back retain this state. Switching interface language translates
controls without changing course-language filters.

API clients may request `/api/v1/courses?format=page&page=2&pageSize=12` for
`{items,total,page,pageSize}`. The default remains an array for compatibility.
Page size is capped at 100, but later pages make courses beyond the first 100
accessible. Counts and items come from one read transaction. Search matches literal
percent/underscore characters rather than treating them as SQL wildcards.

Catalog categories are now managed through **Administer → Manage categories**.
Authors select up to ten per revision; public course pages link to filtered results.
The catalog accepts `category=<slug>` alongside existing search/filter/page parameters.
Unknown or deleted slugs produce an empty result without silently removing the filter.
Names and descriptions are shared authored text; interface controls are translated.
Category assignments change on publication; category metadata edits are immediate.

## Account language behavior

Public home, catalog, course and opted-in instructor pages render interface text
and fallback metadata on the server using the same en/pt-BR/es catalog as the
browser. A supported `displayLocale` selects the requested language; without it,
home uses its selected hero language and course uses its resolved content
language, while catalog/instructor default to English. Unsupported query values
are ignored. Authored titles, summaries and biographies retain their resolved
content rather than receiving invented translations. Canonical URLs remain
query-free. The initial HTML includes localized navigation, footer, empty states,
noscript guidance and Open Graph locale; browser preferences still take over when
JavaScript runs. This is local rendering coverage, not external crawler or
accessibility qualification.

Registration sends the selected interface language and saves it as `users.locale`.
Verification and password recovery emails are queued in that saved language for
English, Brazilian Portuguese or Spanish. Other legacy locale values fall back to
English; API registration without a locale retains the existing `pt-BR` default.
Recovery uses the account locale, never a language supplied by the requester.
Already queued messages retain their existing content.

Account forms preserve entered email/password fields when switching interface
language in the current page. Passwords are not persisted to local/session storage;
page reload/navigation still clears those fields. Credential, duplicate-account,
suspension, password-length and token errors use stable API codes translated by the
web interface. API `error` text remains English for compatibility; clients should
translate `code` instead of matching text.
Signed-in users save interface-language changes to their account. On a new browser
session, the account preference takes precedence over that browser's detected or
locally stored language. Anonymous visitors continue to use a browser-local preference.
The preference is updated through authenticated `PUT /api/v1/auth/locale` and is
returned in `GET /api/v1/auth/me`. Course metadata and caption locales remain
separate authoring concerns; content is not automatically translated. New
verification emails link to the confirmation page described below; verification
and recovery emails use the currently saved account locale. Verification resend
is available after registration; recovery requests invalidate earlier reset links.

Signed-in users can update a private display name and request an account email change
from **My learning**. Email changes require the current password and confirmation
from the new address; the existing email remains active until confirmation. The
confirmed change verifies the new address and revokes existing sessions. The private
display name is not a public instructor profile or a replacement for course
presentation fields. These forms are available in English, Brazilian Portuguese,
and Spanish.

Signed-in learners can change their password from the account-security section of
**My learning** by confirming the current password and entering the new password
twice. The API rejects an incorrect current password and reuse of the existing
password. A successful change revokes all existing sessions and pending reset
tokens, then requires a new sign-in. Form labels, mismatch feedback, and completion
confirmation are tested in English, Brazilian Portuguese, and Spanish.

## Administrator account management

Administrators can open **Manage users** to search by email or display name, filter
by role or status, and page through accounts. Each account shows its role, status,
interface language, email-verification state, and registration date; credential
material is never returned. Administrators can suspend/reactivate accounts and
assign the learner, author, or admin role. Worker assignment is not available.
Actual status and role changes are audited and invalidate existing sessions;
same-value updates are idempotent. Administrators cannot suspend themselves,
demote themselves, or remove the last active administrator. Public instructor
profiles are opt-in and edited separately from the private account display name.
Their public page contains only the chosen public name, biography, HTTPS website,
and published courses; unlisted profiles return not found. Course pages link to
the profile only when it is public. Administrative bootstrap/reset workflows
remain separate work.

## Course review

An author can submit an owned draft from the studio after the publication checklist
passes. The request includes the draft revision ID, so stale editor state cannot be
submitted silently. The course enters **REVIEW** and records an audit event; an
administrator can publish it after review. Direct administrator publishing remains
available for existing operational workflows. An administrator may schedule a
course in REVIEW using local date/time; the API stores UTC, and the worker rechecks
the publication checklist when the time arrives. Invalid or stale schedules are
cleared and audited for correction; admins can reschedule or cancel, and editing the
revision, archiving, or publishing early clears an obsolete schedule. A new revision
of an already-published course queues a localized outbox notice to active learners
with verified email. Their assigned revision and progress remain unchanged; first
publication has no existing learners to notify. Archiving closes discovery and new
enrollment while preserving authorized access for current learners; it is not an
urgent withdrawal. An administrator can separately withdraw a published or archived
course with a required reason. The immutable marker immediately blocks learner
access through existing course/lesson URLs and video, caption, cover, attachment,
enrollment-grant, and progress routes, while preserving enrollment/progress history.
The course is hidden from discovery and cannot be republished through the normal
route. Owner/admin inspection remains available; learners retain the historical
record but no dead course or continue link.

## Assessment definition API

Authors and administrators can save a lesson or final quiz to the current
unpublished course revision with prompts, keyed choices, points, pass threshold,
attempt limit, question randomization, and optional time limit. Definitions are tied to that revision and
cannot be edited after an attempt exists. Enrolled learners can read the quiz for
their assigned course revision; the learner API omits correct-answer keys. A basic
studio builder can edit the final quiz or a lesson quiz, including questions,
choices, answer keys, scoring settings, and deadlines. Preview remains
available as a local dialog that shows unsaved author content and marks correct
choices; it does not save or publish. Publication readiness validates configured quizzes have questions
and consistent choice/answer-key data; quizzes remain optional for older/course types
that do not use assessments. In the lesson player, enrolled learners
can start or resume an open attempt, select choices, submit once, and see the
server-graded score/pass result and remaining attempts. An open attempt can be
resumed after page reload, and selections auto-save without applying a score until
final submission. Private score/pass history is scoped to the learner's
enrollment and revision. After submission, a review panel marks selected and
correct choices and displays the author's explanation; active attempts and quiz
payloads never reveal these details. Expired unsubmitted attempts appear in the
private history as consumed, ungraded attempts without feedback; starting another
attempt remains subject to the configured attempt limit.

Enrolled learners can start or resume one open attempt for a quiz. The attempt
response omits answer keys and includes the deadline and remaining attempt count.
Starting again resumes a still-open, unexpired attempt. An expired attempt remains
in history and consumes one configured attempt, but it does not prevent starting a
remaining attempt.
Submission validates that every question and choice belongs to that quiz, grades
on the server, stores the score/pass result atomically, and treats repeat submit as
returning the original result. An expired deadline is rejected without writing
answers. The player still has no quiz interaction UI, partial-answer recovery, or
explanation of which submitted answers were correct.

## Enrollment support

Administrators can open **Manage enrollments** to search by learner email, course
title, or course address, filter by state, and inspect required-lesson progress and
effective current access. A manual grant requires a published course and a reason.
Revocation also requires a reason and preserves the enrollment, progress, and
earlier entitlements; the revoked enrollment state blocks protected access and the
dashboard reports no current access. Re-grant reactivates the existing enrollment
instead of creating a second record. The history view presents grant/revocation
audit events in insertion order when events share the same stored timestamp.
Provider payment reconciliation is not part of this support workflow.

## Course completion

The learner dashboard uses one server-derived completion policy for the assigned
revision: at least one required lesson must exist, all required lessons must be
marked complete, and every quiz in that revision must have a passing submission
for that enrollment. The server records `completed_at` once, when these conditions
are first met while the learner has active access to a non-withdrawn course.
Repeated progress updates do not change the timestamp. If access is later revoked,
the historical completion timestamp remains, but `completion_ready` becomes false
for current eligibility checks. Eligibility and record issuance are separate
certificate steps described below.

## Certificate eligibility

The authenticated learner can run a read-only eligibility check for one of their
enrollments by supplying the name to print and explicitly consenting to disclosure.
The server checks active access, non-withdrawn course state, recorded completion,
verified email, publisher-declared workload, revision instructor, and whether a
non-revoked certificate already exists. It returns stable reasons and the public
disclosure fields with a versioned hash. Issuance requires that exact hash, then
rechecks eligibility and writes an immutable snapshot plus audit event atomically.
Concurrent submissions and retries return the same active certificate. The snapshot
uses revision instructor as issuer and revision workload minutes; institutional
issuer policy remains to be confirmed. Anonymous API verification is available at
`/api/v1/certificates/verify/{code}`, with a localized public page at
`/certificates/verify/{code}`. Both disclose only the approved snapshot fields and
current status. A worker generates a private PDF with selectable text and a QR
linking to the canonical verification page; the learner or an administrator can
download it once ready. “My learning” lists each issued certificate, its validity
and PDF processing status, the public verification link, and a download action only
when the private PDF is ready.

Administrators can search certificate records, revoke an active certificate with
a private reason, reissue a revoked snapshot once, and inspect enrollment lineage
and actor-attributed lifecycle audit events at `/admin/certificates`. Reissue keeps
the predecessor's code verifiable as revoked and creates a linked successor with
a fresh code and PDF job. Public verification remains deliberately minimal and
does not expose the private reason or lineage details.


## Account privacy request review

The administrator navigation includes **Privacy requests** at `/admin/privacy`.
Search by account email or request ID, filter by OPEN/IN_REVIEW/CLOSED, and use
Previous/Next to browse pages of 25 requests. Empty, loading, error, and retry
states are translated in en/pt-BR/es.
Search and pagination updates focus the result summary; saving a review focuses
the updated request heading. A failed list update focuses its retry button,
and retrying keeps unsaved notes. Private history announces loading with
`aria-busy` and exposes a keyboard-operable retry after failure; a successful
retry returns focus to the history summary.

Each non-closed request has a private review-note field and **Record review**.
The first note changes OPEN to IN_REVIEW; additional notes preserve IN_REVIEW.
Private history shows notes, actor IDs, and timestamps. Notes are escaped text,
not rendered HTML. A failed save retains the input; switching language preserves
notes, applied filters, and page in memory. Reloading/leaving the page does not
persist unsaved notes. Requesters see the actual state in **My learning**, but not
private review notes, and remain able to sign in and learn.

Review is triage only: the page cannot close a request, delete data, suspend an
account, or claim fulfillment. Those actions require a defined retention/legal
policy and a separate resolution workflow.

## Email verification confirmation

New verification emails open `/auth/verify-email?lang=<locale>&token=<token>`.
The page uses the supported language hint (en, pt-BR or es); unsupported hints fall
back to normal browser/local preference detection. The hint applies to this page;
the user may change its language with the existing selector.

Opening the page does not consume the token. The user selects **Verify email** to
submit it through POST. The pending button is disabled; success, invalid-link,
expired-link and already-used feedback is localized. Results stay in memory during
interface-language changes, so changing language never consumes the token again.
A transient network/server failure or rate limit offers a retry. Reloading a
successfully used link reports that it has already been used after confirmation.
No token or email address is displayed in the page body. The sign-in link remains
available after success or failure; verification does not sign the user in.

After registration, the user can request a replacement verification email. The
resend endpoint invalidates outstanding verification links and issues a new
single-use token in the account's saved locale. Known, unknown, already-verified,
and suspended accounts receive the same 204 response. Requests are rate-limited;
the browser displays generic confirmation and does not disclose account state.

Previously queued verification emails may still point directly to the legacy GET
API endpoint. Those links retain their original behavior. Unverified users can sign
in and learn, but certificate issuance requires a verified address; the account
page explains the policy and offers a generic resend action. Verification and
recovery emails remain queued for worker retry if SMTP is unavailable.

Administrators can enable TOTP-based two-step verification from account security.
The setup secret is encrypted at rest; login creates no authenticated session until
the second factor succeeds. Ten single-use recovery codes are shown once and stored
as hashes. A code can recover access when an authenticator is lost; disabling MFA
requires the current password and a valid TOTP/recovery factor and revokes sessions.

## Learner lesson navigation

An authorized lesson response includes its revision's ordered module and lesson
outline, plus the previous and next accessible lesson identifiers. The lesson
page renders the outline and previous/next links. A learner with an active
enrollment sees the assigned revision; visitors see only lessons allowed by the
published course's public-access or preview policy. Owners and administrators can
inspect their authorized draft outline. Restricted lesson titles are omitted from
the outline response.

The learning dashboard's **Continue learning** action prioritizes the last
unfinished lesson with saved activity, then the first unfinished lesson. If every
lesson is complete, it links to the latest lesson with progress activity. Courses
with revoked access do not show the action. This dashboard shortcut does not
change video-position persistence or debouncing. Cross-device resumption and
position-save qualification, along with full PLAY-04 acceptance, remain pending
in the [TODO](../TODO.md).
