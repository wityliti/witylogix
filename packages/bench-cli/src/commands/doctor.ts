import type { Command } from 'commander';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { DEFAULT_CONFIG_FILENAME } from '@witylogix/bench-core';

interface Check {
  id: string;
  name: string;
  run: () => { ok: boolean; detail?: string };
}

function hasBinary(bin: string): { ok: boolean; version?: string } {
  try {
    const out = execSync(`${bin} --version`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
      .split('\n')[0];
    return { ok: true, version: out };
  } catch {
    return { ok: false };
  }
}

const checks: Check[] = [
  {
    id: 'node',
    name: 'Node.js >= 20',
    run: () => {
      const major = Number(process.versions.node.split('.')[0] ?? '0');
      return {
        ok: major >= 20,
        detail: `v${process.versions.node}`,
      };
    },
  },
  {
    id: 'docker',
    name: 'Docker',
    run: () => {
      const r = hasBinary('docker');
      return { ok: r.ok, detail: r.version ?? 'not found' };
    },
  },
  {
    id: 'docker-compose',
    name: 'Docker Compose',
    run: () => {
      try {
        const out = execSync('docker compose version', {
          stdio: ['ignore', 'pipe', 'ignore'],
        })
          .toString()
          .trim()
          .split('\n')[0];
        return { ok: true, detail: out };
      } catch {
        return { ok: false, detail: 'not found — run: docker compose version' };
      }
    },
  },
  {
    id: 'config',
    name: `${DEFAULT_CONFIG_FILENAME} present`,
    run: () => {
      const path = resolve(process.cwd(), DEFAULT_CONFIG_FILENAME);
      return {
        ok: existsSync(path),
        detail: existsSync(path) ? path : 'missing — run `bench init <name>`',
      };
    },
  },
  {
    id: 'bench-service-token',
    name: 'BENCH_SERVICE_TOKEN generated',
    run: () => {
      const path = resolve(process.cwd(), 'secrets', 'bench-service-token');
      return {
        ok: existsSync(path),
        detail: existsSync(path) ? path : 'missing — re-run `bench init` or generate with `openssl rand -base64 32`',
      };
    },
  },
  {
    id: 'env-file',
    name: '.env file present',
    run: () => {
      const path = resolve(process.cwd(), '.env');
      return {
        ok: existsSync(path),
        detail: existsSync(path) ? path : 'missing — re-run `bench init` to generate',
      };
    },
  },
];

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check preconditions for running Witylogix Bench')
    .action(() => {
      const results = checks.map((c) => ({ check: c, result: c.run() }));

      const json = program.opts().json === true;
      if (json) {
        process.stdout.write(
          `${JSON.stringify(
            {
              ok: results.every((r) => r.result.ok),
              checks: results.map((r) => ({
                id: r.check.id,
                name: r.check.name,
                ok: r.result.ok,
                detail: r.result.detail,
              })),
            },
            null,
            2,
          )}\n`,
        );
      } else {
        process.stdout.write('Witylogix Bench doctor\n\n');
        for (const { check, result } of results) {
          const mark = result.ok ? pc.green('✓') : pc.red('✗');
          const detail = result.detail ? pc.dim(`  (${result.detail})`) : '';
          process.stdout.write(`  ${mark} ${check.name}${detail}\n`);
        }
        process.stdout.write('\n');
      }

      const allOk = results.every((r) => r.result.ok);
      process.exit(allOk ? 0 : 2);
    });
}
