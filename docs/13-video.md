# Video lessons — first E2 delivery

This delivery supports uploading, processing and publishing an MP4 video lesson
through the editor. It does not complete E2: adaptive HLS, captions/transcripts,
attachments, the image library, previous/next navigation and VPS qualification
were still in the TODO at this stage. Later deliveries are noted below.

## Installing or upgrading

On a Debian/Ubuntu host, install media tools before upgrading:

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
cd /home/roberto/projects/maia-lms
sudo ./install.sh host --host-ip 10.77.0.2 --proxy-ip 10.77.0.1
```

The installer checks `ffmpeg` and `ffprobe` before stopping services. Migration 005
is additive. The worker is limited to 2 GiB of RAM, two CPUs and 128 tasks in systemd
and Compose installations. The shared Compose image includes FFmpeg; rebuild it
when upgrading. The API and worker use the same private `STORAGE_ROOT`.

No additional port or public route is needed. Uploaded chunks are at most 512 KiB,
below the existing virtual host's 1 MiB limit. The API allows 300 requests/minute
per IP; chunks have a separate limit of 300/minute per authenticated account.
Range/HEAD pass through the existing proxy. Local validation does not establish
VPN capacity, bandwidth or the actual VPS configuration; perform the final test
through the domain after upgrading.

## Author workflow

1. Create the course, module and lesson title, then save the draft. Text may remain
   empty while preparing the video; publication requires text or a ready video.
2. Reopen **Edit**. Under **Video lesson**, select a file and click **Upload / resume**.
3. The indicator shows progress. **Pause** stops after the current chunk. To resume
   after reloading the page, choose the upload in the selector and select the same
   file again. The browser checks SHA-256 for all previously received chunks before
   continuing; a different file is rejected.
4. Once uploaded, the video enters the queue. Use **Refresh status** to follow it.
   **Ready** means the MP4 and poster image have been generated.
5. Save the lesson (or wait for autosave) and publish as an administrator. Processing,
   cancelled or failed videos prevent publication.

A video can be reused in lessons of the same course; another course is rejected.
Selecting **No video** removes the association from the new draft while preserving
previous revisions. To replace a video, upload a new file and publish a new revision.

**Retry processing** requeues a FAILED video. Check FFmpeg/FFprobe, free space and
the limits below. **Cancel incomplete upload** removes persisted chunks from
incomplete uploads; it does not remove published videos. If the upload is active,
pause it before confirming cancellation.

## Current limits

- MP4/MOV or Matroska/WebM inputs, checked by FFprobe; extension/MIME alone is insufficient.
- Up to 2 GiB per original, four hours and a maximum dimension of 4096 pixels per axis.
- Quota of 20 GiB of reserved originals per author, including incomplete uploads.
- H.264/AAC output in fast-start MP4, up to 1280×720, preserving aspect ratio without
  upscaling; up to 4 GiB output. A JPEG poster is generated automatically.
- One processing job per worker, two encoding threads, a four-hour timeout, a heartbeat
  every 15 seconds, and reclaiming jobs with no heartbeat for two minutes.
- Original chunks are retained for retries. Reserve space for temporary files and
  outputs too; the originals quota is not a total disk-usage limit.
- There is no automatic expiration of abandoned uploads or orphan cleanup after
  crashes yet. Cancel incomplete uploads through the dashboard and monitor disk space.
  Do not delete video directories referenced by older revisions.

Objects have server-generated names, temporary writes followed by atomic publication,
and are not overwritten. The adapter rejects traversal and symlinks. Only the service
account should be able to write to the root; do not share it with untrusted local
users. The endpoint receives only one bounded chunk per request; assembly and playback
use streams rather than loading the entire video into RAM.

## Playback and access

The native player supports playback, seeking, volume, fullscreen and speed controls.
Enrolled learners save their position approximately every 15 seconds and when pausing;
completion remains explicit. The session must remain valid.

Each video/poster request revalidates publication, preview, ownership or active
enrollment for the corresponding revision. The storage directory has no public
access. HTTP Range supports 206/416 and HEAD; responses disable private caching.
Revocation blocks new requests but cannot recall bytes already received by the browser.

## Validation and implementation

Make FFmpeg/FFprobe available on PATH:

```bash
npm run build
npm run lint
VIDEO_TEST_REAL=1 npm test
VIDEO_TEST_REAL=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e
```

Without `VIDEO_TEST_REAL=1`, real conversion/playback tests are explicitly skipped.
CI installs FFmpeg and enables those tests. HTTP tests also check permissions,
origin, limits, offsets, cancellation, invalid files and revocation.

The implementation uses [FFmpeg](https://ffmpeg.org/ffmpeg.html) and
[FFprobe](https://ffmpeg.org/ffprobe.html), invoked without a shell, with restricted
input formats and no network protocols. The `video_uploads` queue is independent
of the email outbox. Jobs publish outputs only while they still own the current lease.

Back up SQLite **and** `STORAGE_ROOT`, preserving references and permissions. The
installer's automatic database backup alone does not copy videos.

Update: captions and transcripts are now available; see the [guide](15-captions.md).
Earlier references to pending captions describe the first delivery.

## Duration in the author studio

After processing finishes, the selected video's measured duration appears below
its selector. Use **Refresh status** to retrieve newly processed metadata. Changing
or removing the selected video updates or hides the duration. Until READY with a
valid duration, the editor reports that duration is unavailable rather than showing
zero. Durations use m:ss below one hour and h:mm:ss above it, rounding fractional
seconds up. The value comes from server-side processing and is not author-editable.
It describes video playback time, not estimated reading time or certificate workload.
The label is localized in English, Portuguese, and Spanish. Attachment controls do
not display video duration.

## Private storage contract

Use `openRead(key, { start, end })` for video and attachment streams. The legacy
`readAuthorized(key, maxBytes)` helper is reserved for small objects: it defaults
to 8 MiB, allows a smaller caller limit, and rejects larger limits or objects.
It checks size before reading and counts streamed bytes while collecting them.
The helper's name does not enforce user authorization; API routes must verify
ownership/enrollment before any provider operation.

Storage keys are server-generated. The local adapter rejects traversal, absolute
paths, symbolic-link components, and symlink replacement of its initialized root.
Writes stream to private temporary files, atomically link immutable destinations,
and clean temporary files on failure. Invalid read options close the opened file
descriptor. Root/ancestor ownership remains a deployment requirement: these checks
do not provide isolation against a malicious process with the service account's
filesystem permissions. Keep the storage directory private and inaccessible to
untrusted local writers.
