import pc from "picocolors";
import { NoConfigError, withProvider } from "@witylogix/bench-core";
import type { Context, Provider } from "@witylogix/bench-core";

export interface GlobalOpts {
  json: boolean;
  dryRun: boolean;
}

export async function runWithProvider(
  globals: GlobalOpts,
  action: (ctx: Context, provider: Provider) => Promise<number | void>,
): Promise<never> {
  try {
    const exitCode = await withProvider(action, {
      json: globals.json,
      dryRun: globals.dryRun,
    });
    process.exit(exitCode ?? 0);
  } catch (err) {
    if (err instanceof NoConfigError) {
      process.stderr.write(pc.red(`${err.message}\n`));
      process.exit(1);
    }
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(pc.red(`bench: ${msg}\n`));
    process.exit(3);
  }
}
