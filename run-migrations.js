const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Get database URL from environment or command line
const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL not provided');
  console.error('Usage: node run-migrations.js "postgresql://user:pass@host:port/dbname"');
  console.error('   or: DATABASE_URL="..." node run-migrations.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function runMigration(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n📝 Running migration: ${fileName}`);

  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    await pool.query(sql);
    console.log(`✅ Successfully ran: ${fileName}`);
    return true;
  } catch (error) {
    console.error(`❌ Error running ${fileName}:`, error.message);
    return false;
  }
}

async function runAllMigrations() {
  console.log('🚀 Starting database migrations...\n');
  console.log(`📍 Database: ${DATABASE_URL.replace(/:[^:]*@/, ':****@')}\n`);

  // Test connection
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    process.exit(1);
  }

  // Get all migration files
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  console.log(`Found ${migrationFiles.length} migration files\n`);

  let successful = 0;
  let failed = 0;

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const success = await runMigration(filePath);
    if (success) {
      successful++;
    } else {
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(50) + '\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

// Run migrations
runAllMigrations().catch(error => {
  console.error('Fatal error:', error);
  pool.end();
  process.exit(1);
});
