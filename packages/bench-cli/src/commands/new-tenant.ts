import type { Command } from "commander";
import pc from "picocolors";
import {
  buildContext,
  tenants,
  BenchApiRequestError,
  NoConfigError,
} from "@witylogix/bench-core";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

function parseKv(arr: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of arr) {
    const i = s.indexOf("=");
    if (i < 0) continue;
    out[s.slice(0, i)] = s.slice(i + 1);
  }
  return out;
}

export function registerNewTenantCommand(program: Command): void {
  program
    .command("new-tenant <slug>")
    .description(
      "Provision a tenant in the running installation (Managed plan)",
    )
    .requiredOption("--owner-email <email>", "owner email address")
    .requiredOption(
      "--owner-name <name>",
      "owner full name (quoted if multiple words)",
    )
    .option("--plan <plan>", "plan tier: starter | pro | enterprise", "starter")
    .option(
      "--feature <kv>",
      "feature flag k=v (repeatable)",
      (v: string, acc: string[] = []) => [...acc, v],
      [] as string[],
    )
    .option(
      "--limit <kv>",
      "limit k=v (repeatable)",
      (v: string, acc: string[] = []) => [...acc, v],
      [] as string[],
    )
    .action(
      async (
        slug: string,
        opts: {
          ownerEmail: string;
          ownerName: string;
          plan: "starter" | "pro" | "enterprise";
          feature: string[];
          limit: string[];
        },
      ) => {
        const globals = program.opts<{ json: boolean; dryRun: boolean }>();

        if (!SLUG_RE.test(slug)) {
          process.stderr.write(
            pc.red(
              `bench new-tenant: "${slug}" is not a valid slug. Use lowercase letters, digits, or "-" (2-63 chars, must start with letter or digit).\n`,
            ),
          );
          process.exit(1);
        }

        try {
          const ctx = await buildContext({
            json: globals.json,
            dryRun: globals.dryRun,
          });
          const result = await tenants.createTenant(ctx, {
            slug,
            ownerEmail: opts.ownerEmail,
            ownerName: opts.ownerName,
            plan: opts.plan,
            features: parseKv(opts.feature),
            limits: parseKv(opts.limit),
          });

          if (globals.json) {
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          } else {
            process.stdout.write(
              [
                pc.green(`✓ tenant "${slug}" created`),
                pc.dim(`  orgId:     ${result.orgId}`),
                pc.dim(`  tenantId:  ${result.tenantId}`),
                pc.dim(`  subdomain: ${result.subdomain}`),
                pc.dim(`  owner:     ${result.ownerEmail}`),
                "",
              ].join("\n"),
            );
          }
          process.exit(0);
        } catch (err) {
          if (err instanceof NoConfigError) {
            process.stderr.write(pc.red(`${err.message}\n`));
            process.exit(1);
          }
          if (err instanceof BenchApiRequestError) {
            if (err.data.status === 409) {
              process.stderr.write(
                pc.red(
                  `✗ ${err.data.message}. Try a different slug, e.g. \`bench new-tenant ${slug}-2\`.\n`,
                ),
              );
              process.exit(1);
            }
            if (err.data.status === 400) {
              process.stderr.write(
                pc.red(`✗ validation: ${err.data.message}\n`),
              );
              process.exit(1);
            }
            process.stderr.write(pc.red(`✗ ${err.data.message}\n`));
            process.exit(3);
          }
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(pc.red(`bench: ${msg}\n`));
          process.exit(3);
        }
      },
    );
}
