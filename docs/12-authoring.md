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
audit. The rendering policy still has no persisted version per lesson.

## Supplementary materials

The course and each lesson have a section for attaching files with a title,
description and order. See [supplementary materials](14-materials.md) for uploading,
replacement and access.
