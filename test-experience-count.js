/**
 * Test script to verify experience count calculation
 * Run with: node test-experience-count.js
 */

const { Client } = require('pg');

// Database configuration - update with your database credentials
const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'incollabe',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
});

async function testExperienceCounts() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Test influencers from the API response
    const influencerIds = [11, 89]; // Dhruv Bhatia (11) and Sanket Gupta (89)

    console.log('🔍 Testing Experience Counts for Influencers\n');
    console.log('='.repeat(80));

    for (const influencerId of influencerIds) {
      console.log(`\n📊 Influencer ID: ${influencerId}`);
      console.log('-'.repeat(80));

      // Get influencer name
      const influencerQuery = `
        SELECT id, name, username, "dateOfBirth"
        FROM influencers
        WHERE id = $1
      `;
      const influencerResult = await client.query(influencerQuery, [influencerId]);

      if (influencerResult.rows.length === 0) {
        console.log('❌ Influencer not found');
        continue;
      }

      const influencer = influencerResult.rows[0];
      const dob = new Date(influencer.dateOfBirth);
      const age = new Date().getFullYear() - dob.getFullYear();

      console.log(`Name: ${influencer.name}`);
      console.log(`Username: ${influencer.username}`);
      console.log(`Age: ${age} (DOB: ${influencer.dateOfBirth})`);

      // Get all experiences for this influencer
      const allExperiencesQuery = `
        SELECT
          id,
          "campaignName",
          "brandName",
          "successfullyCompleted",
          "completionDate",
          "createdAt"
        FROM experiences
        WHERE "influencerId" = $1
        ORDER BY "completionDate" DESC NULLS LAST
      `;
      const allExperiences = await client.query(allExperiencesQuery, [influencerId]);

      console.log(`\nTotal Experiences: ${allExperiences.rows.length}`);

      if (allExperiences.rows.length > 0) {
        console.log('\nAll Experiences:');
        allExperiences.rows.forEach((exp, idx) => {
          console.log(`  ${idx + 1}. ${exp.campaignName} (${exp.brandName})`);
          console.log(`     - Successfully Completed: ${exp.successfullyCompleted}`);
          console.log(`     - Completion Date: ${exp.completionDate || 'NULL'}`);
          console.log(`     - Created At: ${exp.createdAt}`);
        });
      }

      // Get completed campaigns count (matching the service logic)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const completedQuery = `
        SELECT COUNT(*) as count
        FROM experiences
        WHERE "influencerId" = $1
          AND "successfullyCompleted" = true
          AND "completionDate" IS NOT NULL
          AND "completionDate" < $2
      `;
      const completedResult = await client.query(completedQuery, [influencerId, today]);
      const completedCount = parseInt(completedResult.rows[0].count);

      console.log(`\n✅ Completed Campaigns Count (matching API logic): ${completedCount}`);
      console.log(`   (successfullyCompleted=true AND completionDate < today)`);

      // Get experiences by different criteria for debugging
      const criteriaQueries = [
        {
          name: 'Successfully Completed (any date)',
          query: `SELECT COUNT(*) FROM experiences WHERE "influencerId" = $1 AND "successfullyCompleted" = true`,
        },
        {
          name: 'Has Completion Date',
          query: `SELECT COUNT(*) FROM experiences WHERE "influencerId" = $1 AND "completionDate" IS NOT NULL`,
        },
        {
          name: 'Completion Date < Today',
          query: `SELECT COUNT(*) FROM experiences WHERE "influencerId" = $1 AND "completionDate" < $2`,
          params: [today],
        },
      ];

      console.log('\n📈 Debug Counts:');
      for (const criteria of criteriaQueries) {
        const params = criteria.params
          ? [influencerId, ...criteria.params]
          : [influencerId];
        const result = await client.query(criteria.query, params);
        console.log(`   ${criteria.name}: ${result.rows[0].count}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🧪 Testing Experience Filter\n');
    console.log('='.repeat(80));

    // Test campaign applications with experience filter
    const campaignId = 36; // From your API request

    console.log(`\nCampaign ID: ${campaignId}`);

    // Get all applications for this campaign
    const applicationsQuery = `
      SELECT
        ca.id,
        ca."influencerId",
        i.name,
        i.username
      FROM campaign_applications ca
      JOIN influencers i ON ca."influencerId" = i.id
      WHERE ca."campaignId" = $1
      ORDER BY ca.id
    `;
    const applications = await client.query(applicationsQuery, [campaignId]);

    console.log(`\nTotal Applications: ${applications.rows.length}\n`);

    // Test each experience level filter
    const experienceLevels = [
      { value: 0, label: '0 campaigns (No experience)', filter: '= 0' },
      { value: 1, label: '1+ campaigns', filter: '>= 1' },
      { value: 2, label: '2+ campaigns', filter: '>= 2' },
      { value: 3, label: '3+ campaigns', filter: '>= 3' },
      { value: 4, label: '4+ campaigns', filter: '>= 4' },
      { value: 5, label: '5+ campaigns', filter: '>= 5' },
    ];

    for (const level of experienceLevels) {
      console.log(`\n📌 Experience Filter: ${level.label}`);
      console.log('-'.repeat(40));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const filterQuery = `
        SELECT
          ca.id,
          ca."influencerId",
          i.name,
          COUNT(e.id) FILTER (
            WHERE e."successfullyCompleted" = true
              AND e."completionDate" IS NOT NULL
              AND e."completionDate" < $2
          ) as completed_count
        FROM campaign_applications ca
        JOIN influencers i ON ca."influencerId" = i.id
        LEFT JOIN experiences e ON i.id = e."influencerId"
        WHERE ca."campaignId" = $1
        GROUP BY ca.id, ca."influencerId", i.name
        HAVING COUNT(e.id) FILTER (
          WHERE e."successfullyCompleted" = true
            AND e."completionDate" IS NOT NULL
            AND e."completionDate" < $2
        ) ${level.filter}
        ORDER BY i.name
      `;

      const result = await client.query(filterQuery, [campaignId, today]);

      console.log(`Matching Applications: ${result.rows.length}`);
      if (result.rows.length > 0) {
        result.rows.forEach(row => {
          console.log(`  - ${row.name} (ID: ${row.influencerid}): ${row.completed_count} completed campaigns`);
        });
      } else {
        console.log('  No applications match this filter');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Test completed successfully!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the test
testExperienceCounts();
