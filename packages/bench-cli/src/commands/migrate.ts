import type { Command } from 'commander';
import { printNotImplemented } from './_stub.js';

export function registerMigrateCommand(program: Command): void {
  program
    .command('migrate')
    .description('Run Prisma migrations against the configured database')
    .action(() => printNotImplemented('migrate', 'Phase 1'));
}
