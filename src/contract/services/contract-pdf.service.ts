import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as crypto from 'crypto';
import * as path from 'path';

export interface SignatureBlock {
  signerName: string;
  username?: string;
  phone?: string;
  email?: string;
  signedAt: Date;
  ipAddress: string;
  partyLabel: string; // e.g. "SIGNED BY (BRAND)", "SIGNED BY (CREATOR)"
  signatureImageBase64?: string; // PNG data URL or empty
  contractNumber: string;
  contentHash: string;
}

@Injectable()
export class ContractPdfService {
  /**
   * SHA-256 hash of the contract body text — used as the tamper-evident seal.
   * Store this hash separately from the PDF. Re-compute and compare to verify.
   */
  hashContractText(text: string): string {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  }

  /**
   * Generate the final signed contract PDF.
   * Returns a Buffer ready to be uploaded to S3.
   */
  async generateSignedContractPdf(params: {
    contractNumber: string;
    contractType: string;
    contractBodyText: string;
    contentHash: string;
    signatureBlocks: SignatureBlock[];
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const margin = 50;

      /* ── HEADER ── */
      try {
        const logoPath = path.join(process.cwd(), 'src', 'assets', 'collabkaroo-logo.png');
        doc.image(logoPath, margin, 40, { fit: [180, 50] });
      } catch {
        doc.fontSize(20).fillColor('#4285F4').font('Helvetica-Bold')
          .text('Collabkaroo', margin, 45, { width: 250 });
      }

      doc
        .fontSize(11).fillColor('#6b7280').font('Helvetica')
        .text(`Contract No: ${params.contractNumber}`, pageWidth - 250, 45, { width: 200, align: 'right' })
        .text(this.contractTypeLabel(params.contractType), pageWidth - 250, 62, { width: 200, align: 'right' });

      doc
        .strokeColor('#e5e7eb').lineWidth(1)
        .moveTo(margin, 98).lineTo(pageWidth - margin, 98).stroke();

      doc.moveDown(2);

      /* ── CONTRACT BODY ── */
      doc.fontSize(9).fillColor('#374151').font('Helvetica');
      const lines = params.contractBodyText.split('\n');

      for (const line of lines) {
        if (line.startsWith('━')) {
          // Section dividers
          doc.strokeColor('#e5e7eb').lineWidth(0.5)
            .moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
          doc.moveDown(0.3);
        } else if (line.match(/^\d+\.|^[A-Z\s]{6,}$/) && line.trim().length > 3) {
          // Section headers and numbered items
          doc.font('Helvetica-Bold').fontSize(9).text(line, { continued: false });
          doc.font('Helvetica').fontSize(9);
        } else {
          doc.text(line.length > 0 ? line : ' ', { continued: false });
        }
      }

      /* ── SIGNATURE BLOCKS ── */
      for (const sig of params.signatureBlocks) {
        if (doc.y > doc.page.height - 260) {
          doc.addPage();
        }

        const blockTop = doc.y + 20;

        doc
          .strokeColor('#374151').lineWidth(0.5)
          .moveTo(margin, blockTop).lineTo(pageWidth - margin, blockTop).stroke();

        doc.y = blockTop + 12;

        doc
          .fontSize(10).font('Helvetica-Bold').fillColor('#000000')
          .text(sig.partyLabel, margin, doc.y);

        doc.y += 16;
        doc.fontSize(9).font('Helvetica').fillColor('#374151');

        doc.text(`Name: ${sig.signerName}`, margin, doc.y);
        doc.y += 14;
        if (sig.username) { doc.text(`Handle: @${sig.username}`, margin, doc.y); doc.y += 14; }
        if (sig.phone)    { doc.text(`Phone: ${sig.phone}`,        margin, doc.y); doc.y += 14; }
        if (sig.email)    { doc.text(`Email: ${sig.email}`,        margin, doc.y); doc.y += 14; }

        doc.text(
          `Date & Time: ${sig.signedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
          margin, doc.y,
        );
        doc.y += 14;
        doc.text(`Device IP: ${sig.ipAddress}`, margin, doc.y);
        doc.y += 14;

        /* Signature image */
        if (sig.signatureImageBase64) {
          try {
            const base64Data = sig.signatureImageBase64.replace(/^data:image\/\w+;base64,/, '');
            const imgBuffer = Buffer.from(base64Data, 'base64');
            doc.image(imgBuffer, margin, doc.y, { width: 160, height: 60 });
            doc.y += 70;
          } catch {
            doc.text('[Signature on file]', margin, doc.y);
            doc.y += 20;
          }
        } else {
          doc.text('[Collabkaroo — Platform Authorised Signatory]', margin, doc.y);
          doc.y += 20;
        }

        doc.y += 10;
      }

      /* ── FOOTER WITH HASH ── */
      if (doc.y > doc.page.height - 80) doc.addPage();

      const footerY = doc.page.height - 70;
      doc
        .strokeColor('#e5e7eb').lineWidth(0.5)
        .moveTo(margin, footerY - 10).lineTo(pageWidth - margin, footerY - 10).stroke();

      doc
        .fontSize(7).fillColor('#9ca3af').font('Helvetica')
        .text(`Contract ID: ${params.contractNumber}`, margin, footerY)
        .text(`Security Code (SHA-256): ${params.contentHash}`, margin, footerY + 12, { width: pageWidth - 2 * margin })
        .text(
          'This document was generated by Collabkaroo. To verify its authenticity, recompute the SHA-256 hash of the contract body and compare with the Security Code above.',
          margin, footerY + 24,
          { width: pageWidth - 2 * margin },
        );

      doc.end();
    });
  }

  /**
   * Generate an evidence bundle PDF — contains contract + full audit log.
   * Used when a breach is escalated to legal.
   */
  async generateEvidenceBundlePdf(params: {
    contractNumber: string;
    contractType: string;
    contractBodyText: string;
    contentHash: string;
    signatureBlocks: SignatureBlock[];
    auditLog: Array<{
      action: string;
      actorType: string;
      actorId: number;
      ipAddress: string;
      metadata: Record<string, any>;
      createdAt: Date;
    }>;
    breachDetails: Record<string, any>;
  }): Promise<Buffer> {
    // Extend the contract PDF with an audit log section
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const margin = 50;

      /* Cover page */
      doc
        .fontSize(22).font('Helvetica-Bold').fillColor('#dc2626')
        .text('EVIDENCE BUNDLE', margin, 80, { align: 'center', width: pageWidth - 2 * margin });

      doc
        .fontSize(12).font('Helvetica').fillColor('#374151')
        .text(`Contract No: ${params.contractNumber}`, margin, 120, { align: 'center', width: pageWidth - 2 * margin })
        .text(`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`, margin, 138, { align: 'center', width: pageWidth - 2 * margin })
        .text('CONFIDENTIAL — FOR LEGAL USE ONLY', margin, 156, { align: 'center', width: pageWidth - 2 * margin });

      if (params.breachDetails && Object.keys(params.breachDetails).length) {
        doc.y = 200;
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#dc2626').text('BREACH SUMMARY', margin, doc.y);
        doc.y += 16;
        doc.fontSize(9).font('Helvetica').fillColor('#374151');
        doc.text(JSON.stringify(params.breachDetails, null, 2), margin, doc.y, { width: pageWidth - 2 * margin });
      }

      /* Contract section */
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000').text('SECTION 1 — SIGNED CONTRACT', margin, margin);
      doc.y = margin + 30;

      doc.fontSize(9).font('Helvetica').fillColor('#374151');
      for (const line of params.contractBodyText.split('\n')) {
        doc.text(line.length > 0 ? line : ' ');
      }

      /* Signature blocks */
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('SECTION 2 — SIGNATURES', margin, margin);
      doc.y = margin + 30;

      for (const sig of params.signatureBlocks) {
        doc.fontSize(10).font('Helvetica-Bold').text(sig.partyLabel, margin, doc.y);
        doc.y += 14;
        doc.fontSize(9).font('Helvetica');
        doc.text(`Name: ${sig.signerName}  |  IP: ${sig.ipAddress}  |  ${sig.signedAt.toISOString()}`, margin, doc.y);
        doc.y += 20;
      }

      /* Audit log section */
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('SECTION 3 — FULL AUDIT LOG', margin, margin);
      doc.y = margin + 30;

      for (const entry of params.auditLog) {
        if (doc.y > doc.page.height - 60) doc.addPage();
        doc
          .fontSize(8).font('Helvetica').fillColor('#374151')
          .text(
            `[${new Date(entry.createdAt).toISOString()}] ${entry.action.toUpperCase()} | ` +
            `Actor: ${entry.actorType}#${entry.actorId ?? 'system'} | ` +
            `IP: ${entry.ipAddress ?? 'N/A'}`,
            margin, doc.y, { width: pageWidth - 2 * margin },
          );
        if (entry.metadata && Object.keys(entry.metadata).length) {
          doc.y += 12;
          doc.fillColor('#6b7280').text(`  ${JSON.stringify(entry.metadata)}`, margin, doc.y, { width: pageWidth - 2 * margin });
        }
        doc.y += 16;
      }

      /* Footer hash */
      const footerY = doc.page.height - 60;
      doc.fontSize(7).fillColor('#9ca3af').font('Helvetica')
        .text(`Security Code: ${params.contentHash}`, margin, footerY, { width: pageWidth - 2 * margin });

      doc.end();
    });
  }

  private contractTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      platform_brand: 'Platform–Brand Agreement',
      platform_influencer: 'Platform–Creator Agreement',
      brand_influencer: 'Brand–Creator Collaboration Agreement',
    };
    return labels[type] ?? type;
  }
}
