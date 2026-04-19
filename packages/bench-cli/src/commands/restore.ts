import type { Command } from 'commander';
import { printNotImplemented } from './_stub.js';

export function registerRestoreCommand(program: Command): void {
  program
    .command('restore <archive>')
    .description('Restore the installation from a backup archive')
    .option('--yes', 'skip confirmation when target DB is non-empty', false)
    .action(() => printNotImplemented('restore', 'Phase 1'));
}
