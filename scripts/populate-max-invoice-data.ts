/**
 * Script to populate invoice data for existing Max Campaign invoices
 * Run with: npx ts-node scripts/populate-max-invoice-data.ts
 */

import { Pool } from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'root',
  database: process.env.POSTGRES_DB || 'incollab_db',
});

async function populateInvoiceData() {
  const client = await pool.connect();

  try {
    console.log('🔗 Connecting to database...');
    await client.query('SELECT 1');
    console.log('✅ Database connected successfully\n');

    // Get all paid invoices without invoice data or PDF URL
    const result = await client.query(`
      SELECT
        mci.id,
        mci."invoiceNumber",
        mci.amount,
        mci.tax,
        mci."totalAmount",
        mci."paidAt",
        mci."createdAt",
        mci."campaignId",
        mci."brandId",
        c.name as campaign_name,
        b."brandName" as brand_name,
        b.email as brand_email
      FROM max_campaign_invoices mci
      JOIN campaigns c ON mci."campaignId" = c.id
      JOIN brands b ON mci."brandId" = b.id
      WHERE mci."paymentStatus" = 'paid'
        AND (mci."invoiceData" IS NULL OR mci."invoiceUrl" IS NULL)
    `);

    const invoices = result.rows;
    const total = invoices.length;

    console.log(`📊 Found ${total} paid invoices without invoice data\n`);

    if (total === 0) {
      console.log('✅ All paid invoices already have invoice data!');
      client.release();
      await pool.end();
      process.exit(0);
    }

    console.log('🚀 Starting invoice data population...\n');

    let processed = 0;
    const errors: Array<{ id: number; error: string }> = [];

    for (const invoice of invoices) {
      try {
        const invoiceData = {
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.paidAt || invoice.createdAt,
          brand: {
            name: invoice.brand_name,
            email: invoice.brand_email,
          },
          campaign: {
            name: invoice.campaign_name,
          },
          items: [
            {
              description: 'Max Campaign Upgrade - Premium campaign visible to Pro influencers only',
              quantity: 1,
              rate: invoice.amount / 100,
              amount: invoice.amount / 100,
            },
          ],
          subtotal: invoice.amount / 100,
          tax: invoice.tax / 100,
          total: invoice.totalAmount / 100,
        };

        await client.query(
          `UPDATE max_campaign_invoices
           SET "invoiceData" = $1
           WHERE id = $2`,
          [JSON.stringify(invoiceData), invoice.id]
        );

        processed++;
        console.log(
          `✅ [${processed}/${total}] Generated data for invoice ${invoice.invoiceNumber} (ID: ${invoice.id})`,
        );
      } catch (error) {
        errors.push({
          id: invoice.id,
          error: error.message,
        });
        console.error(
          `❌ [${processed + 1}/${total}] Failed for invoice ID ${invoice.id}: ${error.message}`,
        );
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Successfully processed ${processed} invoices`);

    if (errors.length > 0) {
      console.log(`❌ Failed for ${errors.length} invoices:`);
      errors.forEach((err) => {
        console.log(`   - Invoice ID ${err.id}: ${err.error}`);
      });
    }

    // Verify results
    const statsResult = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE "paymentStatus" = 'paid') as total_paid,
        COUNT(*) FILTER (WHERE "paymentStatus" = 'paid' AND "invoiceData" IS NOT NULL) as with_data,
        COUNT(*) FILTER (WHERE "paymentStatus" = 'paid' AND "invoiceData" IS NULL) as without_data
      FROM max_campaign_invoices
    `);

    const stats = statsResult.rows[0];

    console.log('\n📊 Final Statistics:');
    console.log(`   Total Paid Invoices: ${stats.total_paid}`);
    console.log(`   With Invoice Data: ${stats.with_data}`);
    console.log(`   Without Invoice Data: ${stats.without_data}`);
    console.log('='.repeat(60) + '\n');

    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    client.release();
    await pool.end();
    process.exit(1);
  }
}

// Run the script
populateInvoiceData();
