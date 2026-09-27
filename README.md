# Maia LMS

**Learn from real software, built in the open.**

Maia LMS is a focused, video-first course publishing platform for Maia Platform. It offers public lessons, enrolled free courses, and paid courses with progress tracking, quizzes, and publicly verifiable certificates. It is initially a single publisher platform, with invited instructors as a later option.

## Access modes

| Mode | Anonymous viewing | Account | Enrollment | Certificate |
|---|---:|---:|---:|---:|
| OPEN_FREE | Yes | No | No | No |
| ENROLLED_FREE | Preview only | Yes | Yes | If eligible |
| PAID | Preview only | Yes | After confirmed payment | If eligible |

A public preview is a separately marked lesson. All courses have public catalog pages. OPEN_FREE can offer an optional account enrollment later, but anonymous views never generate an identity-linked certificate.

## Product scope

Course catalog, search, categories, promotions, landing pages, video/text/attachments, lesson progress, objective quizzes, checkout, certificate verification, author/admin tools, and basic analytics. Maia Chat/RAG course assistant, subtitles/transcripts, coupons, cohorts, multiple authors, and advanced marketing automation are staged extensions. See [scope](docs/01-product.md) and [roadmap](docs/09-roadmap.md).

## Architecture

A server-rendered or progressively enhanced HTML/CSS/JavaScript frontend talks to a Node.js API, PostgreSQL, a media worker, and a file storage adapter. Nginx fronts the application. The deployment can run with Maia Edge, keeping video assets on premises, but must be measured against uplink and concurrent audience capacity. See [architecture](docs/02-architecture.md), [data model](docs/03-data-model.md), [API](spec/openapi.yaml), and [operations](docs/08-operations.md).

## Repository layout (implementation target)

```text
apps/web/               catalog, learner UI, author studio
apps/api/               HTTP API and domain modules
apps/worker/            video, mail and certificate jobs
packages/domain/        types, policies, validation
packages/providers/     payment, storage and email ports/adapters
packages/ui/            reusable components
migrations/             reviewed SQL migrations
infra/                  compose and Nginx configuration
docs/                   decisions and runbooks
spec/openapi.yaml       contract starting point
```

This repository currently contains the implementation specification and issue templates. Create application directories in milestone order; do not treat the API contract as a deployed server.

## First implementation slice

1. Bootstrap API/web/worker, PostgreSQL migrations, configuration validation, health probes and CI.
2. Publish a public catalog and one OPEN_FREE course with accessible video and text.
3. Add accounts, enrollment, lesson progress and quiz attempts.
4. Add Mercado Pago checkout, verified webhook, entitlement and refunds.
5. Add certificate issuance and public verification; complete the release gate.

Each step has testable acceptance criteria in [roadmap](docs/09-roadmap.md). Deployment requires production secrets, actual business/payment credentials, media capacity, and a privacy/legal review.

## Documentation

- [Product and flows](docs/01-product.md)
- [Architecture and media](docs/02-architecture.md)
- [Data model and invariants](docs/03-data-model.md)
- [Payments](docs/04-payments.md)
- [Certificates and assessment](docs/05-assessment-certificates.md)
- [Security and privacy](docs/06-security-privacy.md)
- [UI and accessibility](docs/07-experience.md)
- [Operations and deployment](docs/08-operations.md)
- [Roadmap and acceptance](docs/09-roadmap.md)
- [Decisions and open questions](docs/10-decisions.md)
- [API contract](spec/openapi.yaml)

## License

Apache License 2.0 for code and original documentation in this repository. Course content, logos, videos, and third-party media require separate rights and are not covered by the code license. See [LICENSE](LICENSE).
