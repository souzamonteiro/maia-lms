import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expect, it } from 'vitest';
import { runMigrations } from '../../api/src/db/migrate.js';
import { LocalStorageProvider } from '@maia/providers';
import { processCertificatePdf } from './certificate-pdf.js';

it('generates a private PDF with readable certificate fields and an embedded verification QR, idempotently', async () => {
  const db = new Database(':memory:');
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-certificate-pdf-'));
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  try {
    db.exec(`
      INSERT INTO users(id,email,email_normalized,password_hash)
      VALUES('pdf-user','pdf@example.com','pdf@example.com','hash');
      INSERT INTO courses(id,slug,author_id) VALUES('pdf-course','pdf-course','pdf-user');
      INSERT INTO course_revisions(id,course_id,title,summary)
      VALUES('pdf-revision','pdf-course','The Analytical Engine','Course summary');
      INSERT INTO enrollments(id,user_id,course_id,revision_id)
      VALUES('pdf-enrollment','pdf-user','pdf-course','pdf-revision');
    `);
    const publicCode = 'A'.repeat(43);
    const snapshot = {
      confirmedName: 'Ada Lovelace',
      courseTitle: 'The Analytical Engine',
      courseSlug: 'pdf-course',
      workloadMinutes: 90,
      issuerName: 'Maia Academy',
      completedAt: '2026-10-03T10:00:00.000Z',
      publicCode,
      issuedAt: '2026-10-03T12:00:00.000Z',
      status: 'valid',
    };
    db.prepare(
      `INSERT INTO certificates(
        id,enrollment_id,public_code,confirmed_name,payload_hash,issued_at,payload_json,
        disclosure_hash,disclosure_consented_at,disclosure_version,pdf_status
      ) VALUES(?,?,?,?,?,?,?,?,?,?,'PENDING')`,
    ).run(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'pdf-enrollment',
      publicCode,
      snapshot.confirmedName,
      'payload-hash',
      snapshot.issuedAt,
      JSON.stringify(snapshot),
      'a'.repeat(64),
      snapshot.issuedAt,
      'certificate-disclosure-v1',
    );

    await processCertificatePdf(db, storageRoot, 'https://learn.example.test', { certificateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, 1);
    const certificate = db
      .prepare('SELECT pdf_status,pdf_storage_key FROM certificates WHERE id=?')
      .get('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') as { pdf_status: string; pdf_storage_key: string };
    expect(certificate).toEqual({
      pdf_status: 'READY',
      pdf_storage_key: 'certificates/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/certificate.pdf',
    });

    const storage = new LocalStorageProvider(storageRoot, 'unused', 'https://learn.example.test');
    const pdf = await storage.readAuthorized(certificate.pdf_storage_key);
    expect(pdf.subarray(0, 8).toString()).toBe('%PDF-1.3');
    expect(pdf.toString()).toContain('https://learn.example.test/certificates/verify/');
    const parsedPdf = await getDocument({ data: new Uint8Array(pdf) }).promise;
    const pageText = await parsedPdf.getPage(1).then(page => page.getTextContent());
    const extractedText = pageText.items
      .filter(item => 'str' in item)
      .map(item => item.str)
      .join(' ');
    expect(extractedText).toContain('Ada Lovelace');
    expect(extractedText).toContain('The Analytical Engine');
    expect(extractedText).toContain('Maia Academy');

    await expect(
      processCertificatePdf(db, storageRoot, 'https://learn.example.test', { certificateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, 2),
    ).resolves.toBeUndefined();
  } finally {
    db.close();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  }
});
