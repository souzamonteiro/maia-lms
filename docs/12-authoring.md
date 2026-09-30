# Authoring and homepage

## Creating and editing

Sign in as an author or administrator at `/admin`. Enter the title, slug, summary,
content language and free-access mode; add modules and lessons. Course language
is independent of the interface language selector.

New lessons use Markdown. The toolbar uses icons with translated tooltips and
accessible names. It inserts headings, bold, italics, lists, quotes, code, links,
images and tables. Use **Preview content** to check the server-rendered result.
HTML written in the lesson is displayed literally; scripts, dangerous URLs and
embeds are not executed. Images accept only local site paths; the button inserts
markup, not an upload. Image upload remains pending. For video lessons, see the
[video guide](13-video.md).

Existing lessons retain plain text. Explicitly choosing Markdown changes how the
content is interpreted; check the preview before publishing.

Save once to create the course. After that, valid changes are saved after a pause
of approximately 1.6 seconds. Saving still creates a revision of the entire course.
Invalid fields prevent server saves; the status reports the error. Local recovery
is available in the same browser/account when browser storage is available. It
neither replaces backups nor synchronizes drafts across devices. Changing the
interface language preserves editing state. Leaving with pending changes triggers
the browser's warning.

Buttons duplicate, remove and move modules/lessons up or down. Removal requires
confirmation. Dragging and separate screens for each lesson are not available yet.

Two tabs do not silently overwrite the same revision: the second save receives a
conflict and retains local text. Copy any content you want to keep before confirming
that the server version should be reloaded.

## Publication

Saving changes only the draft. Visitors and new enrollments continue using the
published revision; existing learners remain on their enrollment revision. The
administrator publishes through the dashboard. This action promotes the revision's
content, slug, language and access mode in one transaction. Archiving removes public
discovery and new enrollment while preserving access already granted.

## Selecting homepage courses

As an administrator, open `/admin/home`. Add published courses to the hero (at most
one), featured section or recommendations. Set priority (lower first), start time
and optional end time. The form uses local time and submits UTC. Save the selection.

The homepage shows only active, published selections. Removing a featured placement
does not remove the course from the catalog at `/courses`. Custom-named collections,
cover images and uploads are not available here yet. Concurrent edits to the
selection cause a version conflict.

## Migration and validation

The additive `004_authoring.sql` migration is applied by the existing migrator.
It preserves `current_revision_id` as the editable pointer and adds
`published_revision_id`. It automatically assigns a public revision only for a
PUBLISHED/ARCHIVED course whose revision already has `published_at`; it does not
republish old drafts. Revision metadata and `content_format` preserve legacy content.

Before updating production, follow backup/restoration and installation instructions
in [operations](08-operations.md). This delivery was validated with temporary
databases; the published database was not migrated and services were not restarted.

Local validation: build, 38 automated tests and 3 Chrome tests. They cover legacy
migration, permissions, public/enrollment revisions, sanitization, homepage schedules,
concurrency, local recovery, switching between three languages and a 390px mobile
viewport. This does not equal Safari/Android qualification or a complete accessibility
audit. Rendering policy versioning was added subsequently, as described below.

## Supplementary materials

The course and each lesson have a section for attaching files with a title,
description and order. See [supplementary materials](14-materials.md) for uploading,
replacement and access.

## Versioned rendering — migration 008

Every lesson stores `render_policy_version`. Migration 008 pins existing plain and
Markdown lessons to policy 1 without changing their bodies, revisions, or enrollments.
New revisions use the current server-selected policy; clients cannot override it.
The preview returns `renderPolicyVersion` alongside `html`, using that same current
policy. Lesson delivery renders using the stored version and exposes it as
`render_policy_version`. Unknown policies fail closed instead of falling back.

Future rendering changes must introduce an explicit policy version and retain
support for historical versions. Security fixes apply to every supported policy;
pinning a version must never preserve a known unsafe renderer. Policy 1 keeps raw
HTML literal, sanitizes Markdown with an allowlist, and restricts images to local paths.

## Focused editing and ordering

Enable **Edit one section at a time** to show a course outline. Select **Course
settings**, a module, or a lesson to work on that section. Disable the option to
return to the complete form. Switching sections keeps the existing inputs and media
components mounted, preserving text and ongoing work. Language changes retain the
selected section. A validation error reveals the section containing the invalid field.

Use the dotted drag handle in a module or lesson's controls to reorder it. Modules
move within the course; lessons move within their current module. Dropping on a
later sibling moves the item after it; dropping on an earlier sibling moves it
before that sibling. **Move up** and **Move down** remain available for keyboard
and touch operation. Reordering uses the existing draft autosave and local recovery;
publication and enrolled revisions are unchanged until explicitly published.

The outline is an editing view, not a complete learner/visitor preview. Saving
still sends the entire course draft; per-unit incremental saving remains pending.

## Preview a draft as a learner or visitor

Choose **Preview draft** to save the current form and open its saved revision in a
modal preview. Invalid fields or save conflicts must be resolved first. Select
**Enrolled learner** to inspect all lessons and materials, or **Visitor** to inspect
open-course content and lessons marked as public previews. Restricted lessons show
an enrollment message without their bodies, video, captions, or attachments.

The preview includes sanitized lesson text, video controls, caption tracks,
transcripts, and attachment downloads. Video must finish processing before it can
play. Escape or **Close preview** returns to the editor; closing or changing audience
stops playback. No enrollment, progress, or publication is created by the preview.

This is an author-only simulation of the draft after publication, not a public
preview URL or a login as another user. Media requests retain the author's normal
authorization. The API checks ownership and the expected current revision and sends
`Cache-Control: private, no-store`. A concurrent edit requires reloading the draft.

## Incremental saves

Existing drafts compare the form with the last acknowledged save. Only changed
course metadata, module titles, and lessons are sent via PATCH; a lesson includes
its text, settings, media, captions, and attachment metadata. Several changed units
are committed together. Each request carries `expectedRevisionId`; another editor's
save causes a conflict rather than silently overwriting their work. Module/lesson
indexes are valid only for that exact revision.

Adding or removing modules/lessons uses the full PUT workflow. New courses use POST,
and recovered older drafts without a saved baseline use PUT. All saves still require
a valid course form. No-op saves send no request. The server creates a complete new
revision for every accepted change, preserving publication and enrollment snapshots;
this optimization reduces transferred content, not database revision storage.

After a network error, the draft and acknowledged baseline remain in local recovery.
Reloading or switching language preserves edits. Use **Save draft** to retry; if the
server accepted an earlier request but its response was lost, a conflict requires
reloading/reconciling rather than blindly retrying over the newer revision.

## Publication readiness

Selecting **Publish** checks the exact saved revision and displays all detected
blockers together, identified by module, lesson, or attachment title. Add text or
a video to empty lessons, wait for processing or replace failed media, and save
again before retrying publication. Video-only lessons do not require placeholder
text. An invalid stored module/lesson order is rebuilt by saving the draft.

The API also rejects media associated with another course, incorrect media kinds,
and attachment references to a lesson outside the revision. Publication repeats
these checks inside its transaction, so the preflight result does not bypass
validation or guarantee later publication. A changed draft returns DRAFT_CONFLICT.
The checklist is available only to the course owner or an administrator, while
publication remains administrator-only. Existing published and enrolled revisions
remain unchanged when checks fail.

## Course covers

Save the course first, then use **Course cover** to upload a PNG/JPEG or select an
existing image from the course. Add **Cover alternative text** describing the image.
Refresh its processing status and save the draft. Publication requires a READY
image and nonblank alternative text; the cover itself is optional. Select **No cover**
and save to remove it from the next revision without deleting the image file.

Covers appear on catalog cards, editorial homepage placements, the course page,
and draft previews. They use the image processing limits documented in
[materials](14-materials.md#png-and-jpeg-materials). Editing or removing a draft cover
does not change the live cover until publication. Existing enrolled revisions keep
their cover. Only the current published cover is public; other revisions require
author/admin access or an active enrollment assigned to that revision.

## Objectives, prerequisites, level, and workload

Course settings include **Learning objectives** and **Prerequisites** (plain text,
up to 5,000 characters each), **Course level** (unspecified, beginner, intermediate,
or advanced), and **Estimated workload (minutes)** (blank or an integer from 1 to
60,000). Blank values are omitted from the public presentation. Workload is an
estimate supplied by the author, separate from measured video duration and future
certificate eligibility rules.

These values appear on the course page and in the draft preview. Labels and level
names follow the interface language; author-written content is not automatically
translated. Values belong to the revision, survive lesson-only incremental saves,
and reach the public page only when that revision is published. Existing enrolled
learners continue to see their assigned revision's presentation.

## Instructor and course terms

Course settings include **Instructor name** (up to 200 characters), **Instructor
biography**, **Access terms**, and **Certificate information** (up to 5,000 characters
each). All are optional plain text; markup is displayed literally. Empty sections
are omitted from the public page and draft preview. The author supplies these
texts; interface language changes translate labels, not the written content.

These fields describe the course and belong to its revision. They do not change
account roles, ownership, access expiration, refunds, or completion rules. Changes
become public only on publication; enrolled learners retain their assigned revision.
When certificate information is present, the page explicitly states that this
platform does not yet issue certificates. Certificate issuance remains a separate
planned feature. Instructor text is a course presentation, not an account profile
or identity verification system.
