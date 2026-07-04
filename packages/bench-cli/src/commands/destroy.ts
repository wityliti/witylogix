import type { Command } from "commander";
import pc from "picocolors";
import { runWithProvider, type GlobalOpts } from "./_helpers.js";

export function registerDestroyCommand(program: Command): void {
  program
    .command("destroy")
    .description("Tear down the installation (removes containers and volumes)")
    .requiredOption("--confirm <name>", "type the installation name to confirm")
    .action(async (opts: { confirm: string }) => {
      const globals = program.opts<GlobalOpts>();
      await runWithProvider(globals, async (ctx, provider) => {
        if (opts.confirm !== ctx.config.metadata.name) {
          process.stderr.write(
            pc.red(
              `bench destroy: --confirm "${opts.confirm}" does not match installation name "${ctx.config.metadata.name}".\n`,
            ),
          );
          return 1;
        }
        await provider.destroy(ctx, {
          installationName: ctx.config.metadata.name,
          acknowledged: true,
        });
        process.stdout.write(
          pc.green(`✓ destroyed ${ctx.config.metadata.name}\n`),
        );
        return 0;
      });
    });
}
