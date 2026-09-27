// Core domain types for Maia LMS

export type UserId = string;
export type CourseId = string;
export type EnrollmentId = string;
export type LessonId = string;
export type AttemptId = string;
export type CertificateId = string;
export type OrderId = string;
export type AssetId = string;

export type UserRole = 'learner' | 'author' | 'admin' | 'worker';
export type UserStatus = 'active' | 'suspended';

export interface User {
  id: UserId;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  locale: string;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CourseStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type AccessMode = 'OPEN_FREE' | 'ENROLLED_FREE' | 'PAID';

export interface Course {
  id: CourseId;
  slug: string;
  accessMode: AccessMode;
  status: CourseStatus;
  locale: string;
  authorId: UserId;
  currentRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseRevision {
  id: string;
  courseId: CourseId;
  title: string;
  summary: string;
  learningOutcomes: string;
  policyJson: string;
  publishedAt: string | null;
  createdAt: string;
}

export type LessonKind = 'video' | 'article' | 'mixed';

export interface Module {
  id: string;
  revisionId: string;
  sortOrder: number;
  title: string;
}

export interface Lesson {
  id: LessonId;
  moduleId: string;
  sortOrder: number;
  kind: LessonKind;
  mediaId: AssetId | null;
  body: string | null;
  isRequired: boolean;
  isPreview: boolean;
}

export type AssetKind = 'video' | 'attachment' | 'image';
export type AssetStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface Asset {
  id: AssetId;
  ownerId: UserId;
  kind: AssetKind;
  storageKey: string;
  status: AssetStatus;
  metadataJson: string;
  createdAt: string;
  updatedAt: string;
}

export type EnrollmentState = 'active' | 'revoked';

export interface Enrollment {
  id: EnrollmentId;
  userId: UserId;
  courseId: CourseId;
  revisionId: string;
  state: EnrollmentState;
  enrolledAt: string;
}

export interface Entitlement {
  id: string;
  enrollmentId: EnrollmentId;
  sourceType: 'free' | 'order' | 'admin';
  sourceId: string | null;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
}

export interface LessonProgress {
  enrollmentId: EnrollmentId;
  lessonId: LessonId;
  positionSeconds: number;
  completedAt: string | null;
}

export type OrderState =
  | 'CREATED'
  | 'CHECKOUT_PENDING'
  | 'PAID'
  | 'EXPIRED'
  | 'CANCELED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'CHARGEBACK';

export interface Order {
  id: OrderId;
  userId: UserId;
  courseId: CourseId;
  priceSnapshot: number;
  currency: string;
  provider: string;
  state: OrderState;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Certificate {
  id: CertificateId;
  enrollmentId: EnrollmentId;
  publicCode: string;
  payloadHash: string;
  issuedAt: string;
  revokedAt: string | null;
  reason: string | null;
}
