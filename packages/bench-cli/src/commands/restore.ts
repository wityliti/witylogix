import type { Command } from "commander";
import pc from "picocolors";
import {
  buildContext,
  restore as restoreOps,
  BenchApiRequestError,
  NoConfigError,
} from "@witylogix/bench-core";

export function registerRestoreCommand(program: Command): void {
  program
    .command("restore <archive>")
    .description("Restore the installation from a backup archive")
    .option("--yes", "skip confirmation when target DB is non-empty", false)
    .option("--skip-blobs", "do not restore blobs even if present", false)
    .option(
      "--force-version",
      "allow cross-major-version restore (dangerous)",
      false,
    )
    .option(
      "--cross-install",
      "allow restore into a differently-named installation",
      false,
    )
    .option(
      "--target-storage <url>",
      "upload blobs to a different bucket (T15+)",
    )
    .action(
      async (
        archive: string,
        opts: {
          yes: boolean;
          skipBlobs: boolean;
          forceVersion: boolean;
          crossInstall: boolean;
          targetStorage?: string;
        },
      ) => {
        const globals = program.opts<{ json: boolean; dryRun: boolean }>();
        try {
          const ctx = await buildContext({
            json: globals.json,
            dryRun: globals.dryRun,
          });
          const r = await restoreOps.run(ctx, archive, {
            yes: opts.yes,
            skipBlobs: opts.skipBlobs,
            forceVersion: opts.forceVersion,
            crossInstall: opts.crossInstall,
            targetStorage: opts.targetStorage,
          });
          if (globals.json) {
            process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
          } else {
            process.stdout.write(
              pc.green(
                `✓ restored from ${archive} (${r.durationMs}ms, ` +
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
          if (err instanceof BenchApiRequestError) {
            process.stderr.write(pc.red(`✗ admin API: ${err.data.message}\n`));
            process.exit(3);
          }
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(pc.red(`✗ bench restore: ${msg}\n`));
          process.exit(5);
        }
      },
    );
}
