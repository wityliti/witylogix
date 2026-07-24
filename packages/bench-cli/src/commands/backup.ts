import type { Command } from "commander";
import pc from "picocolors";
import {
  buildContext,
  backup as backupOps,
  NoConfigError,
} from "@witylogix/bench-core";

export function registerBackupCommand(program: Command): void {
  program
    .command("backup")
    .description("Back up the installation (DB + config; optionally blobs)")
    .option(
      "--to <path>",
      "destination archive path (default: ./backups/<name>-<ts>.wbak)",
    )
    .option(
      "--include-blobs",
      "snapshot referenced object-storage blobs (T15)",
      false,
    )
    .action(async (opts: { to?: string; includeBlobs: boolean }) => {
      const globals = program.opts<{ json: boolean; dryRun: boolean }>();
      try {
        const ctx = await buildContext({
          json: globals.json,
          dryRun: globals.dryRun,
        });
        if (opts.includeBlobs) {
          process.stderr.write(
            pc.yellow(
              "⚠ --include-blobs not yet implemented (T15) — blob snapshot skipped, DB + config only.\n",
            ),
          );
        }
        const r = await backupOps.run(ctx, {
          to: opts.to,
          includeBlobs: opts.includeBlobs,
        });
        if (globals.json) {
          process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
        } else {
          const mb = (r.sizeBytes / 1024 / 1024).toFixed(1);
          process.stdout.write(
            pc.green(
              `✓ backup → ${r.archive} (${mb} MB, ${r.durationMs}ms, ` +
                `${r.manifest.counts.tenants} tenants, ${r.manifest.counts.orders} orders)\n`,
            ),
          );
        }
        process.exit(0);
      } catch (err) {
        if (err instanceof NoConfigError) {
          process.stderr.write(pc.red(`${err.message}\n`));
          process.exit(1);
        }
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(pc.red(`✗ bench backup: ${msg}\n`));
        process.exit(3);
      }
    });
}
