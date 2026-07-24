import type { Command } from "commander";
import pc from "picocolors";
import { runWithProvider, type GlobalOpts } from "./_helpers.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show the state, version, and health of each service")
    .action(async () => {
      const globals = program.opts<GlobalOpts>();
      await runWithProvider(globals, async (ctx, provider) => {
        const report = await provider.status(ctx);

        if (globals.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
          return 0;
        }

        if (report.services.length === 0) {
          process.stdout.write(
            pc.dim(
              `no services running for ${ctx.config.metadata.name} — try \`bench start\`\n`,
            ),
          );
          return 0;
        }

        process.stdout.write(`\n  ${pc.bold(ctx.config.metadata.name)}\n\n`);
        for (const s of report.services) {
          const mark =
            s.state === "running" && s.healthy
              ? pc.green("●")
              : s.state === "running"
                ? pc.yellow("●")
                : s.state === "stopped"
                  ? pc.dim("○")
                  : pc.red("●");
          const health = s.healthy ? pc.green("healthy") : pc.dim("—");
          process.stdout.write(
            `  ${mark} ${s.name.padEnd(20)} ${s.state.padEnd(10)} ${health}\n`,
          );
        }
        process.stdout.write("\n");
        return 0;
      });
    });
}
