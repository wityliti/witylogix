import type { Command } from 'commander';
import { runWithProvider, type GlobalOpts } from './_helpers.js';

export function registerLogsCommand(program: Command): void {
  program
    .command('logs <service>')
    .description('Tail logs from a service')
    .option('-f, --follow', 'follow log output', false)
    .option('--since <duration>', 'show logs since duration (e.g. 10m, 1h)')
    .option('--tail <n>', 'number of lines to show', '200')
    .action(async (
      service: string,
      opts: { follow: boolean; since?: string; tail: string },
    ) => {
      const globals = program.opts<GlobalOpts>();
      await runWithProvider(globals, async (ctx, provider) => {
        const tail = Number.parseInt(opts.tail, 10);
        for await (const line of provider.logs(ctx, service, {
          follow: opts.follow,
          since: opts.since,
          tail: Number.isNaN(tail) ? undefined : tail,
        })) {
          process.stdout.write(`${line.message}\n`);
        }
        return 0;
      });
    });
}
