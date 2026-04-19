import pc from 'picocolors';

export function printNotImplemented(command: string, phase: string): never {
  process.stderr.write(
    [
      pc.yellow(`bench ${command}: not yet implemented.`),
      pc.dim(`  scheduled for ${phase} — see docs/bench/ARCHITECTURE.md`),
      '',
    ].join('\n'),
  );
  process.exit(1);
}
