#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { registerProvider } from '@witylogix/bench-core';
import { registerInitCommand } from './commands/init.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerStartCommand } from './commands/start.js';
import { registerStopCommand } from './commands/stop.js';
import { registerStatusCommand } from './commands/status.js';
import { registerDeployCommand } from './commands/deploy.js';
import { registerMigrateCommand } from './commands/migrate.js';
import { registerNewTenantCommand } from './commands/new-tenant.js';
import { registerBackupCommand } from './commands/backup.js';
import { registerRestoreCommand } from './commands/restore.js';
import { registerLogsCommand } from './commands/logs.js';
import { registerDestroyCommand } from './commands/destroy.js';

registerProvider('docker-compose', async () => {
  const { createDockerComposeProvider } = await import(
    '@witylogix/bench-provider-docker-compose'
  );
  return createDockerComposeProvider();
});

const program = new Command();

program
  .name('bench')
  .description('Witylogix Bench — provision and operate Witylogix installations')
  .version('0.0.1')
  .option('--json', 'emit JSON output where supported', false)
  .option('--dry-run', 'show what would change without applying', false);

registerInitCommand(program);
registerDoctorCommand(program);
registerStartCommand(program);
registerStopCommand(program);
registerStatusCommand(program);
registerDeployCommand(program);
registerMigrateCommand(program);
registerNewTenantCommand(program);
registerBackupCommand(program);
registerRestoreCommand(program);
registerLogsCommand(program);
registerDestroyCommand(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(pc.red(`bench: ${message}\n`));
  process.exit(1);
});
