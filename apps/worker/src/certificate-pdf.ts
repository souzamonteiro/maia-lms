import type Database from 'better-sqlite3';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { LocalStorageProvider } from '@maia/providers';
import { Readable } from 'node:stream';
import { z } from 'zod';

const jobSchema = z.object({ certificateId: z.string().uuid() });
const snapshotSchema = z.object({
  confirmedName: z.string().min(1),
  courseTitle: z.string().min(1),
  courseSlug: z.string().min(1),
  workloadMinutes: z.number().int().positive(),
  issuerName: z.string().min(1),
  completedAt: z.string().min(1),
  publicCode: z.string().min(32),
  issuedAt: z.string().min(1),
  status: z.literal('valid'),
});

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid certificate date');
  return date.toISOString().slice(0, 10);
}

async function renderCertificate(snapshot: z.infer<typeof snapshotSchema>, verificationUrl: string) {
  const qrCode = await QRCode.toBuffer(verificationUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 200,
  });
  const document = new PDFDocument({ size: 'A4', margin: 56, compress: false, info: { Title: `Certificate - ${snapshot.courseTitle}`, Author: snapshot.issuerName } });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    document.on('data', chunk => chunks.push(Buffer.from(chunk)));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });

  document.rect(36, 36, 523, 770).lineWidth(2).strokeColor('#14644b').stroke();
  document.fillColor('#14644b').fontSize(11).font('Helvetica-Bold').text('MAIA LEARN', 56, 74, { align: 'center' });
  document.moveDown(2);
  document.fillColor('#132a34').font('Helvetica-Bold').fontSize(27).text('Certificate of Completion', { align: 'center' });
  document.moveDown(1.5);
  document.fillColor('#42565c').font('Helvetica').fontSize(13).text('This certifies that', { align: 'center' });
  document.moveDown(0.5);
  document.fillColor('#132a34').font('Helvetica-Bold').fontSize(23).text(snapshot.confirmedName, { align: 'center' });
  document.moveDown(0.8);
  document.fillColor('#42565c').font('Helvetica').fontSize(13).text('has completed the course', { align: 'center' });
  document.moveDown(0.5);
  document.fillColor('#132a34').font('Helvetica-Bold').fontSize(18).text(snapshot.courseTitle, { align: 'center' });
  document.moveDown(0.6);
  document.fillColor('#42565c').font('Helvetica').fontSize(11).text(`Declared workload: ${snapshot.workloadMinutes} minutes`, { align: 'center' });
  document.moveDown(0.3);
  document.text(`Completed: ${formatDate(snapshot.completedAt)}    Issued: ${formatDate(snapshot.issuedAt)}`, { align: 'center' });
  document.moveDown(0.5);
  document.text(`Issuer: ${snapshot.issuerName}`, { align: 'center' });
  document.image(qrCode, 232, 510, { width: 130, height: 130 });
  document.fontSize(8).fillColor('#42565c').text('Scan to verify this certificate', 56, 648, { align: 'center' });
  document.fontSize(8).text(verificationUrl, 56, 663, { align: 'center', link: verificationUrl });
  document.fontSize(8).text(`Certificate code: ${snapshot.publicCode}`, 56, 684, { align: 'center' });
  document.fillColor('#68777b').fontSize(8).text(
    'This record confirms course completion under the published course requirements. It does not certify independently verified professional competence or institutional accreditation.',
    80,
    733,
    { width: 430, align: 'center' },
  );
  document.end();
  return output;
}

export async function processCertificatePdf(
  db: Database.Database,
  root: string,
  publicBaseUrl: string,
  payload: unknown,
  attempt: number,
): Promise<void> {
  const { certificateId } = jobSchema.parse(payload);
  const certificate = db
    .prepare('SELECT public_code,payload_json,pdf_status,pdf_storage_key FROM certificates WHERE id=?')
    .get(certificateId) as
    | { public_code: string; payload_json: string | null; pdf_status: string; pdf_storage_key: string | null }
    | undefined;
  if (!certificate?.payload_json) throw new Error('Certificate snapshot not found');
  if (certificate.pdf_status === 'READY' && certificate.pdf_storage_key) return;

  const storage = new LocalStorageProvider(root, 'unused', publicBaseUrl);
  const storageKey = `certificates/${certificateId}/certificate.pdf`;
  const verificationUrl = `${publicBaseUrl.replace(/\/$/, '')}/certificates/verify/${encodeURIComponent(certificate.public_code)}`;
  try {
    try {
      await storage.stat(storageKey);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const snapshot = snapshotSchema.parse(JSON.parse(certificate.payload_json));
      const pdf = await renderCertificate(snapshot, verificationUrl);
      try {
        await storage.putPrivate(storageKey, Readable.from([pdf]), 'application/pdf');
      } catch (putError) {
        if ((putError as NodeJS.ErrnoException).code !== 'EEXIST') throw putError;
        await storage.stat(storageKey);
      }
    }
    db.prepare(
      "UPDATE certificates SET pdf_status='READY',pdf_storage_key=?,pdf_error=NULL WHERE id=? AND pdf_status IN ('PENDING','FAILED')",
    ).run(storageKey, certificateId);
  } catch (error) {
    db.prepare(
      "UPDATE certificates SET pdf_status=?,pdf_error=? WHERE id=? AND pdf_status='PENDING'",
    ).run(attempt >= 5 ? 'FAILED' : 'PENDING', 'Certificate PDF generation failed', certificateId);
    throw error;
  }
}
