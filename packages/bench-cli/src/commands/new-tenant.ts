import type { Command } from 'commander';
import { printNotImplemented } from './_stub.js';

export function registerNewTenantCommand(program: Command): void {
  program
    .command('new-tenant <slug>')
    .description('Provision a tenant (Managed plan) in the running installation')
    .action(() => printNotImplemented('new-tenant', 'Phase 1'));
}
