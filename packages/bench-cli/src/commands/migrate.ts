import type { Command } from "commander";
import pc from "picocolors";
import {
  buildContext,
  migrate as migrateOps,
  BenchApiRequestError,
  NoConfigError,
} from "@witylogix/bench-core";

export function registerMigrateCommand(program: Command): void {
  program
    .command("migrate")
    .description("Run Prisma migrations (windowed: stop API, migrate, restart)")
    .option(
      "--skip-backup",
      "skip pre-migrate auto-backup (no-op until T13 lands)",
      false,
    )
    .option("--force", "run even if no migrations are pending", false)
    .action(async (opts: { skipBackup: boolean; force: boolean }) => {
      const globals = program.opts<{ json: boolean; dryRun: boolean }>();
      try {
        const ctx = await buildContext({
          json: globals.json,
          dryRun: globals.dryRun,
        });
        const r = await migrateOps.run(ctx, {
          skipBackup: opts.skipBackup,
          force: opts.force,
        });
        if (globals.json) {
          process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
        } else if (r.degraded) {
          process.stdout.write(
            pc.yellow(
              `⚠ applied ${r.migrationsApplied} migration(s) in ${r.durationMs}ms ` +
                `but post-migrate health did not recover — check \`bench status\`\n`,
            ),
          );
        } else {
          process.stdout.write(
            pc.green(
              `✓ applied ${r.migrationsApplied} migration(s) in ${r.durationMs}ms\n`,
            ),
          );
        }
        // Exit-code contract (spec §4.3):
        //   0 success, 4 partial (rolled back or degraded health), 5 not rolled back.
        process.exit(r.degraded ? 4 : 0);
      } catch (err) {
        if (err instanceof NoConfigError) {
          process.stderr.write(pc.red(`${err.message}\n`));
          process.exit(1);
        }
        if (err instanceof BenchApiRequestError) {
          process.stderr.write(pc.red(`✗ admin API: ${err.data.message}\n`));
          process.exit(3);
        }
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(pc.red(`✗ bench migrate: ${msg}\n`));
        process.exit(5);
      }
    });
}
