import type { Command } from 'commander';
import pc from 'picocolors';
import { runWithProvider, type GlobalOpts } from './_helpers.js';

export function registerDeployCommand(program: Command): void {
  program
    .command('deploy')
    .description('Apply bench.config.yaml to the configured provider')
    .action(async () => {
      const globals = program.opts<GlobalOpts>();
      await runWithProvider(globals, async (ctx, provider) => {
        const pre = await provider.preflight(ctx);
        if (!pre.ok) {
          process.stderr.write(pc.red('preflight failed — run `bench doctor`\n'));
          return 2;
        }
        const result = await provider.deploy(ctx, {
          operations: [],
          summary: `deploy ${ctx.config.metadata.name}`,
        });
        if (!result.ok) {
          process.stderr.write(pc.red(`deploy failed: ${result.message ?? 'unknown'}\n`));
          return 3;
        }
        process.stdout.write(
          pc.green(
            `✓ deployed ${ctx.config.metadata.name} @ ${result.version} via ${provider.id}\n`,
          ),
        );
        return 0;
      });
    });
}
