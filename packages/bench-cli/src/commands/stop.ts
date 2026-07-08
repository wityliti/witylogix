import type { Command } from "commander";
import pc from "picocolors";
import { runWithProvider, type GlobalOpts } from "./_helpers.js";

export function registerStopCommand(program: Command): void {
  program
    .command("stop [service]")
    .description(
      "Stop services gracefully. Without <service>, stops all services.",
    )
    .action(async (service: string | undefined) => {
      const globals = program.opts<GlobalOpts>();
      await runWithProvider(globals, async (ctx, provider) => {
        await provider.stop(ctx, service);
        process.stdout.write(
          pc.green(
            `✓ stopped ${service ?? "all services"} (${ctx.config.metadata.name})\n`,
          ),
        );
        return 0;
      });
    });
}
