# Captions and transcripts

In the lesson editor, open **Captions**. There is one optional track per platform
language: Portuguese, English and Spanish. Enter the name that will appear in the
player, then import a `.vtt` file or edit its contents in the WebVTT field. Save the
draft and publish.

Accepted example:

```text
WEBVTT

00:00.000 --> 00:03.000
Welcome to the course.

00:03.000 --> 00:06.500
In this lesson we will prepare the environment.
```

This version accepts plain text, optional cue identifiers, `MM:SS.mmm` or
`HH:MM:SS.mmm` timestamps, LF/CRLF line endings and UTF-8 files with or without a
BOM. Cue start times must be increasing (equal times are allowed for overlapping
cues), and each end must be later than its start. The limit is 100,000 UTF-8 bytes
per track and three tracks per lesson. The general 1 MiB request limit still
applies to the entire course.

CSS, regions, positioning settings and HTML markup are not supported in this first
version. There is no SRT import, speech recognition or automatic translation. Cue
timing must match the video; the author should check synchronization in the player.
There is no automatic timing adjustment.

To replace a track, import/edit the text in the same language section. To remove
it, empty the WebVTT field. Both actions affect only the draft until publication;
existing learners continue using the content and captions from their enrollment
revision. Changing the interface language preserves tracks being edited.

In the player, learners choose a track through the native caption control. Below
the lesson, **Transcript** displays each track's text without timestamps and with
HTML escaping. Transcripts are derived from captions; they do not replace human
review of the content.

## Access and updates

`GET /api/v1/lessons/:id/captions/:language` serves `text/vtt` only for a READY video
and an authorized lesson. It checks revision, publication/preview, ownership or
active enrollment on every request, with private caching disabled. Revocation
prevents new requests; text already received by the browser cannot be recalled.

The additive `007_captions.sql` migration adds `lessons.captions_json` with default
`[]`, preserving older lessons. SQLite backups already include the tracks. No new
dependency, port or VPS configuration is needed; use the normal host upgrade
procedure. This delivery was validated locally without deployment.
