import type { Command } from 'commander';
import { printNotImplemented } from './_stub.js';

export function registerBackupCommand(program: Command): void {
  program
    .command('backup')
    .description('Back up the database, uploads, and config to an archive')
    .option('--to <path>', 'destination path or URI')
    .action(() => printNotImplemented('backup', 'Phase 1'));
}
