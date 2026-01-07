import PDFDocument from 'pdfkit';

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
export async function generateBrandInvoicePDF(invoiceData: BrandInvoiceData): Promise<Buffer> {
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

    // Header - CollabKaroo logo and INVOICE title
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
      .text(invoiceData.invoiceNumber, pageWidth - 200, 65, { width: 150, align: 'right' });

    // Issued and Billed To section
    doc
      .fontSize(10)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Issued', margin, 100)
      .font('Helvetica')
      .fontSize(13)
      .fillColor('#374151')
      .text(new Date(invoiceData.date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }), margin, 118);

    doc
      .fontSize(10)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Billed to', margin + 180, 100)
      .font('Helvetica')
      .fontSize(13)
      .fillColor('#374151')
      .text(invoiceData.brand.name, margin + 180, 118);

    // From section (Company details)
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

    // Table header
    const tableTop = 200;
    const colPositions = {
      service: margin,
      qty: margin + 240,
      rate: margin + 300,
      hscCode: margin + 370,
      taxes: margin + 450
    };

    // Table header with light border
    doc
      .fontSize(13)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text('Service', colPositions.service, tableTop)
      .text('Qty', colPositions.qty, tableTop)
      .text('Rate', colPositions.rate, tableTop)
      .text('HSC Code', colPositions.hscCode, tableTop)
      .text('Taxes', colPositions.taxes, tableTop);

    // Header bottom border
    doc
      .strokeColor('#e5e7eb')
      .lineWidth(1)
      .moveTo(margin, tableTop + 18)
      .lineTo(pageWidth - margin, tableTop + 18)
      .stroke();

    // Table rows
    let yPosition = tableTop + 30;
    invoiceData.items.forEach((item) => {
      doc
        .fontSize(14)
        .font('Helvetica')
        .fillColor('#374151')
        .text(item.description, colPositions.service, yPosition, { width: 220 })
        .text(item.quantity.toString(), colPositions.qty, yPosition)
        .text(`₹${item.rate.toFixed(2)}`, colPositions.rate, yPosition)
        .text(item.hscCode || 'N/A', colPositions.hscCode, yPosition)
        .text(`₹${item.taxes.toFixed(2)}`, colPositions.taxes, yPosition);
      yPosition += 35;

      // Row bottom border
      doc
        .strokeColor('#f1f5f9')
        .lineWidth(1)
        .moveTo(margin, yPosition - 5)
        .lineTo(pageWidth - margin, yPosition - 5)
        .stroke();
    });

    // Totals section
    yPosition += 20;
    const totalsX = pageWidth - 240;
    const totalsValueX = pageWidth - 100;

    doc
      .fontSize(14)
      .font('Helvetica')
      .fillColor('#374151')
      .text('Subtotal', totalsX, yPosition)
      .text(`₹${invoiceData.subtotal.toFixed(2)}`, totalsValueX, yPosition, { align: 'right', width: 80 });

    yPosition += 25;
    doc
      .text('Tax (0%)', totalsX, yPosition)
      .text(`₹${invoiceData.tax.toFixed(2)}`, totalsValueX, yPosition, { align: 'right', width: 80 });

    yPosition += 25;
    // Total border
    doc
      .strokeColor('#e5e7eb')
      .lineWidth(1)
      .moveTo(totalsX, yPosition - 5)
      .lineTo(pageWidth - margin, yPosition - 5)
      .stroke();

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#374151')
      .text('Total', totalsX, yPosition)
      .text(`₹${invoiceData.total.toFixed(2)}`, totalsValueX, yPosition, { align: 'right', width: 80 });

    // Amount due highlighted
    yPosition += 25;
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#1e6dfb')
      .text('Amount due', totalsX, yPosition)
      .text(`INR ₹${invoiceData.total.toFixed(2)}`, totalsValueX, yPosition, { align: 'right', width: 80 });

    // Footer
    const footerY = doc.page.height - 100;

    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#6b7280')
      .text('Thank you', margin, footerY);

    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#6b7280')
      .text('For Query and help,', margin, footerY + 18);

    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#6b7280')
      .text('Computer Generated Invoice', pageWidth - 250, footerY, { align: 'right', width: 200 });

    doc
      .fontSize(12)
      .fillColor('#6b7280')
      .text('contact.us@gobuybill.com', pageWidth - 250, footerY + 18, { align: 'right', width: 200 });

    doc.end();
  });
}
