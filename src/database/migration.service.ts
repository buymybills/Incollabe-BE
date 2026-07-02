import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';

/**
 * File-based migration runner.
 *
 * Convention: any SQL file in the project-root `migrations/` folder whose name
 * starts with a date prefix (YYYYMMDD_) is treated as a schema migration and
 * will be applied automatically on app startup if it has not been applied yet.
 *
 * Examples of files that WILL run:
 *   migrations/20260702_create_reel_categories.sql
 *   migrations/20260703_add_column_to_posts.sql
 *
 * Examples of files that will be IGNORED (no date prefix):
 *   migrations/debug_9650_step1.sql
 *   migrations/check_migration_status.sql
 *   migrations/seed_nudge_templates.sql
 *
 * Applied migrations are recorded in the `schema_migrations` table so they
 * are never executed more than once — restarts and re-deploys are safe.
 */
@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  // Resolve relative to project root (process.cwd()), not dist/
  private readonly migrationsDir = path.join(process.cwd(), 'migrations');

  // Only files matching YYYYMMDD_*.sql are auto-applied
  private readonly MIGRATION_FILE_PATTERN = /^\d{8}_.*\.sql$/;

  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async onModuleInit() {
    await this.ensureTrackingTable();
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      this.logger.log('Database schema is up to date — no pending migrations.');
      return;
    }

    this.logger.log(`Running ${pending.length} pending migration(s)…`);

    for (const filename of pending) {
      await this.applyMigration(filename);
    }

    this.logger.log('All migrations applied successfully.');
  }

  // ---------------------------------------------------------------------------

  private async ensureTrackingTable() {
    await this.sequelize.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
  }

  private async getPendingMigrations(): Promise<string[]> {
    // 1. All migration filenames already in the DB
    const applied = await this.sequelize.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations ORDER BY filename',
      { type: QueryTypes.SELECT },
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    // 2. All timestamped SQL files on disk, sorted alphabetically (= chronologically)
    let files: string[] = [];
    try {
      files = fs
        .readdirSync(this.migrationsDir)
        .filter((f) => this.MIGRATION_FILE_PATTERN.test(f))
        .sort();
    } catch {
      this.logger.warn(`Migrations directory not found: ${this.migrationsDir}`);
      return [];
    }

    // 3. Return only the ones not yet applied
    return files.filter((f) => !appliedSet.has(f));
  }

  private async applyMigration(filename: string) {
    const filePath = path.join(this.migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf8').trim();

    if (!sql) {
      this.logger.warn(`Skipping empty migration file: ${filename}`);
      return;
    }

    this.logger.log(`Applying migration: ${filename}`);

    await this.sequelize.transaction(async (t) => {
      await this.sequelize.query(sql, { transaction: t });
      await this.sequelize.query(
        'INSERT INTO schema_migrations (filename) VALUES (:filename)',
        { replacements: { filename }, transaction: t },
      );
    });

    this.logger.log(`✓ Applied: ${filename}`);
  }
}
