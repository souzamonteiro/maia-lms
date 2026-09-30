# Supplementary materials

The editor supports up to 30 materials per course and up to 30 per lesson, each
with a **title**, **description** and order. PDF, ZIP and source code use the same
private storage and resumable uploads as videos, with their own validation.

## Using the editor

1. Save the course and reopen **Edit** if it is still a new course.
2. Under **Materials** in the course or lesson, click **Add material**.
3. Enter a title and description. Choose an existing file from the same course or
   use **Upload / resume file** to upload a new one.
4. Use **Refresh status** until **Ready** appears. The worker validates the file;
   on failure, check format/size before retrying validation.
5. Reorder with the arrows or remove the row with the remove button. Save and publish.

To replace a file, upload a new one and select it in the material row. This creates
another revision: enrolled learners retain the files and descriptions from the
previous revision. Removing a row does not delete the physical file. Cancelling an
incomplete upload removes its chunks; remove the empty row too if you do not want
to attach another file.

Learners find materials on the course or lesson page with their description,
filename and size. Clicking the title starts a download.

## Formats, limits and access

- PDF and ZIP: up to 128 MiB; the worker checks the header/signature.
- UTF-8 text/source code: up to 2 MiB; invalid bytes and binary control characters
  are rejected. Extensions: txt, md, csv, json, yaml, yml, xml, toml, js, ts, tsx,
  jsx, py, java, c, cpp, h, cs, go, rs, rb, php, sql, sh, css, html and ipynb.
- Videos and attachments share the quota of 20 GiB of originals per author.
- There is no ZIP extraction, code execution or document viewer on the site.
- Signature/encoding validation **is not a malware scan** or a complete inspection
  of PDF/ZIP contents. That integration remains part of MEDIA-02.

Downloads use `application/octet-stream`, `Content-Disposition: attachment`,
`nosniff` and disabled private caching. Authorization is revalidated for every
request. Course materials follow course access; lesson materials also follow the
preview policy. A copied URL does not unlock private files. Revoked enrollments
cannot start new downloads. A copy already downloaded by a learner cannot be recalled.

## Operations and API

The normal upgrade applies the additive `006_attachments.sql` migration. No new
port, dependency or Nginx change is required. The existing worker validates files,
and publication rejects materials that are not READY. Back up the database **and** storage.

`video_uploads.media_kind` distinguishes videos from attachments while preserving
existing data. `course_attachments` stores metadata and order by revision and
optional lesson. `/admin/files` provides creation, listing, status, chunks,
completion, cancellation and retries. `/attachments/:id/download` provides
authorized GET/HEAD. The complete contract is in [OpenAPI](../spec/openapi.yaml).

Attachments do not complete the remaining E2 items: HLS, captions, orphan cleanup,
the image library and VPS qualification were still pending in the [TODO](../TODO.md)
at this stage.

Update: captions and transcripts are now available; see the [guide](15-captions.md).
Earlier references to pending captions describe the first delivery.

## Optional malware inspection

Set `ATTACHMENT_SCAN_MODE=clamav` in the worker environment to scan attachments
with `clamscan` after signature/encoding validation and before READY. The default
is `disabled`, which performs format checks only and must not be described as
malware inspection. Invalid mode values prevent worker startup.

Install ClamAV and a maintained signature database on the worker host (or inside
its container), verify that the service user can run `clamscan`, and enable the
mode before restarting the worker. For Debian/Ubuntu, the packages are `clamav`
and `clamav-freshclam`; keep the distribution's signature update service working.
The current application image does not bundle those packages. Test the deployment
with a harmless antivirus test fixture and a clean attachment before relying on it.
See the [official ClamAV scanning guide](https://docs.clamav.net/manual/Usage/Scanning.html)
and [command reference](https://github.com/Cisco-Talos/clamav/blob/main/docs/man/clamscan.1.in).

The worker invokes the executable directly, without a shell, with a two-minute
timeout, a 128 MiB file limit, a 512 MiB scan-size limit, and limit-exceeded alerts.
Exit code 0 allows processing to continue. Exit code 1 blocks the attachment with
FILE_MALWARE (including inspection-limit alerts); other failures use FILE_SCAN_FAILED.
Private paths and scanner output are not returned to clients. Failed attachments
remain unavailable; after repairing the scanner, use the existing validation retry.

Enabling scanning does not rescan existing READY attachments. Originals remain in
private storage according to the current lifecycle policy. Antivirus results are
not a guarantee that a file is harmless, and real scanner deployment/signatures
must be validated separately from the automated integration tests.

## PNG and JPEG materials

The material picker also accepts `.png`, `.jpg`, and `.jpeg` for course or lesson
attachments. Add a title and description, upload, and refresh status until READY.
Images have a 10 MiB upload limit, at most 8192 pixels per side, and at most
16 megapixels. SVG, GIF, and other image formats are not accepted by this workflow.

The worker checks the signature, runs optional malware inspection, probes dimensions,
and decodes/re-encodes one image frame with FFmpeg while stripping source metadata.
Each image tool has a 30-second timeout. Invalid, truncated, oversized, or failed
images remain FAILED; normalized output must also fit within 10 MiB. The learner
receives the normalized file as an authorized download, not an inline image. File
size displayed in material metadata describes the original upload; download headers
use the actual normalized size. Course covers and inline lesson images remain pending.
