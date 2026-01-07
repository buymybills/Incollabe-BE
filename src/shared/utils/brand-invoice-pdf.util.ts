import PDFDocument from 'pdfkit';

/**
 * SAFELY format any numeric value for PDF rendering
 * Prevents `.toFixed()` runtime crashes
 */
const formatAmount = (value: number | string | undefined | null): string => {
  const num = Number(value);
  return isNaN(num) ? '0.00' : num.toFixed(2);
};

export interface BrandInvoiceData {
  invoiceNumber: string;
  date: Date | string;
  brand: {
    name: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    hscCode?: string;
    taxes: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
}

/**
 * Generate a professional brand invoice PDF using PDFKit
 * Used for both Max Campaign and Invite-Only Campaign invoices
 */
export async function generateBrandInvoicePDF(
  invoiceData: BrandInvoiceData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const margin = 50;

    /* ================= HEADER ================= */

    doc
      .fontSize(20)
      .fillColor('#1e6dfb')
      .font('Helvetica-Bold')
      .text('CollabKaroo', margin, 40, { width: 250 })
      .fontSize(20)
      .fillColor('#000000')
      .text('INVOICE', pageWidth - 200, 40, { width: 150, align: 'right' })
      .fontSize(12)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text(invoiceData.invoiceNumber, pageWidth - 200, 65, {
        width: 150,
        align: 'right'
      });

    /* ================= META ================= */

    doc
      .fontSize(10)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Issued', margin, 100)
      .font('Helvetica')
      .fontSize(13)
      .fillColor('#374151')
      .text(
        new Date(invoiceData.date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        margin,
        118
      );

    doc
      .fontSize(10)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Billed to', margin + 180, 100)
      .font('Helvetica')
      .fontSize(13)
      .fillColor('#374151')
      .text(invoiceData.brand?.name || 'N/A', margin + 180, 118);

    doc
      .fontSize(10)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('From', pageWidth - 250, 100)
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#374151')
      .text('Deshanta Marketing Solutions Pvt. Ltd', pageWidth - 250, 118, { width: 200 })
      .text('Plot A-18, Manjeet farm', pageWidth - 250, 131, { width: 200 })
      .text('Uttam Nagar, Delhi', pageWidth - 250, 144, { width: 200 })
      .text('West Delhi, Delhi, 110059, IN', pageWidth - 250, 157, { width: 200 })
      .text('GSTIN – 07AACD5691K1ZB', pageWidth - 250, 170, { width: 200 });

    /* ================= TABLE ================= */

    const tableTop = 200;
    const col = {
      service: margin,
      qty: margin + 240,
      rate: margin + 300,
      hsc: margin + 370,
      taxes: margin + 450
    };

    doc
      .fontSize(13)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text('Service', col.service, tableTop)
      .text('Qty', col.qty, tableTop)
      .text('Rate', col.rate, tableTop)
      .text('HSC Code', col.hsc, tableTop)
      .text('Taxes', col.taxes, tableTop);

    doc
      .strokeColor('#e5e7eb')
      .lineWidth(1)
      .moveTo(margin, tableTop + 18)
      .lineTo(pageWidth - margin, tableTop + 18)
      .stroke();

    let y = tableTop + 30;

    invoiceData.items.forEach((item) => {
      doc
        .fontSize(14)
        .font('Helvetica')
        .fillColor('#374151')
        .text(item.description, col.service, y, { width: 220 })
        .text(String(item.quantity ?? 0), col.qty, y)
        .text(`₹${formatAmount(item.rate)}`, col.rate, y)
        .text(item.hscCode || 'N/A', col.hsc, y)
        .text(`₹${formatAmount(item.taxes)}`, col.taxes, y);

      y += 35;

      doc
        .strokeColor('#f1f5f9')
        .lineWidth(1)
        .moveTo(margin, y - 5)
        .lineTo(pageWidth - margin, y - 5)
        .stroke();
    });

    /* ================= TOTALS ================= */

    y += 20;
    const totalsX = pageWidth - 240;
    const totalsValueX = pageWidth - 100;

    doc
      .fontSize(14)
      .font('Helvetica')
      .fillColor('#374151')
      .text('Subtotal', totalsX, y)
      .text(`₹${formatAmount(invoiceData.subtotal)}`, totalsValueX, y, {
        align: 'right',
        width: 80
      });

    y += 25;
    doc
      .text('Tax (0%)', totalsX, y)
      .text(`₹${formatAmount(invoiceData.tax)}`, totalsValueX, y, {
        align: 'right',
        width: 80
      });

    y += 25;
    doc
      .strokeColor('#e5e7eb')
      .lineWidth(1)
      .moveTo(totalsX, y - 5)
      .lineTo(pageWidth - margin, y - 5)
      .stroke();

    doc
      .font('Helvetica-Bold')
      .text('Total', totalsX, y)
      .text(`₹${formatAmount(invoiceData.total)}`, totalsValueX, y, {
        align: 'right',
        width: 80
      });

    y += 25;
    doc
      .fillColor('#1e6dfb')
      .text('Amount due', totalsX, y)
      .text(`INR ₹${formatAmount(invoiceData.total)}`, totalsValueX, y, {
        align: 'right',
        width: 80
      });

    /* ================= FOOTER ================= */

    const footerY = doc.page.height - 100;

    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#6b7280')
      .text('Thank you', margin, footerY)
      .text('For Query and help,', margin, footerY + 18)
      .text('Computer Generated Invoice', pageWidth - 250, footerY, {
        align: 'right',
        width: 200
      })
      .text('contact.us@gobuybill.com', pageWidth - 250, footerY + 18, {
        align: 'right',
        width: 200
      });

    doc.end();
  });
}
