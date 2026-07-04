import type { Command } from "commander";
import pc from "picocolors";
import { runWithProvider, type GlobalOpts } from "./_helpers.js";

export function registerStartCommand(program: Command): void {
  program
    .command("start [service]")
    .description("Bring services up. Without <service>, starts all services.")
    .action(async (service: string | undefined) => {
      const globals = program.opts<GlobalOpts>();
      await runWithProvider(globals, async (ctx, provider) => {
        const pre = await provider.preflight(ctx);
        if (!pre.ok) {
          process.stderr.write(
            pc.red("preflight failed — run `bench doctor`\n"),
          );
          return 2;
        }
        await provider.start(ctx, service);
        process.stdout.write(
          pc.green(
            `✓ started ${service ?? "all services"} (${ctx.config.metadata.name})\n`,
          ),
        );
        return 0;
      });
    });
}
