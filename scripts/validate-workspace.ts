#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

interface ValidationResult {
  pass: boolean;
  issues: string[];
}

interface PackageInfo {
  name: string;
  path: string;
  hasRequiredScripts: boolean;
  missingScripts: string[];
}

const ROOT = process.cwd();
const REQUIRED_SCRIPTS = ['build', 'lint', 'typecheck'];
const SHARED_DEPS = ['react', 'typescript', 'next'];
const WORKSPACE_PATTERNS = [
  'apps/*',
  'packages/*',
  'extensions/*'
];

function getWorkspacePaths(): string[] {
  const packagesPath = path.join(ROOT, 'pnpm-workspace.yaml');

  if (!fs.existsSync(packagesPath)) {
    console.error('✗ pnpm-workspace.yaml not found');
    return [];
  }

  return WORKSPACE_PATTERNS.flatMap(pattern => {
    const globPattern = pattern.split('/')[0];
    const dir = path.join(ROOT, globPattern);

    if (!fs.existsSync(dir)) {
      return [];
    }

    return fs.readdirSync(dir)
      .filter(f => fs.statSync(path.join(dir, f)).isDirectory())
      .map(f => path.join(dir, f));
  });
}

function validatePackageJsonScripts(): { results: PackageInfo[]; issues: string[] } {
  const workspacePaths = getWorkspacePaths();
  const results: PackageInfo[] = [];
  const issues: string[] = [];

  for (const wsPath of workspacePaths) {
    const packageJsonPath = path.join(wsPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      const scripts = pkg.scripts || {};

      const missingScripts = REQUIRED_SCRIPTS.filter(
        script => !(script in scripts)
      );

      const hasRequiredScripts = missingScripts.length === 0;

      results.push({
        name: pkg.name || path.basename(wsPath),
        path: wsPath,
        hasRequiredScripts,
        missingScripts
      });

      if (!hasRequiredScripts) {
        issues.push(
          `✗ ${pkg.name || wsPath}: missing scripts [${missingScripts.join(', ')}]`
        );
      }
    } catch (err) {
      issues.push(`✗ ${wsPath}: failed to parse package.json - ${err}`);
    }
  }

  return { results, issues };
}

function validateEnvExample(): string[] {
  const envExamplePath = path.join(ROOT, '.env.example');
  const issues: string[] = [];

  if (!fs.existsSync(envExamplePath)) {
    issues.push('✗ .env.example not found at repository root');
  } else {
    const content = fs.readFileSync(envExamplePath, 'utf-8');
    const requiredVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'NODE_ENV'
    ];

    const missing = requiredVars.filter(v => !content.includes(v));
    if (missing.length > 0) {
      issues.push(
        `✗ .env.example missing required variables: [${missing.join(', ')}]`
      );
    }
  }

  return issues;
}

function validateDependencyVersions(): string[] {
  const workspacePaths = getWorkspacePaths();
  const versionMap: { [key: string]: Map<string, string> } = {};
  const issues: string[] = [];

  for (const dep of SHARED_DEPS) {
    versionMap[dep] = new Map();
  }

  for (const wsPath of workspacePaths) {
    const packageJsonPath = path.join(wsPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      for (const sharedDep of SHARED_DEPS) {
        if (sharedDep in deps) {
          const version = deps[sharedDep];
          const pkgName = pkg.name || path.basename(wsPath);
          versionMap[sharedDep].set(pkgName, version);
        }
      }
    } catch (err) {
      // silently skip parse errors
    }
  }

  // Check for mismatches
  for (const [dep, versions] of Object.entries(versionMap)) {
    const uniqueVersions = new Set(versions.values());

    if (uniqueVersions.size > 1) {
      const versionList = Array.from(versions.entries())
        .map(([pkg, ver]) => `${pkg}@${ver}`)
        .join(', ');

      issues.push(
        `⚠ ${dep} version mismatch: ${versionList}`
      );
    }
  }

  return issues;
}

function printTable(results: PackageInfo[]): void {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('WORKSPACE VALIDATION SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`${' Package Name'.padEnd(35)} │ ${'Status'.padEnd(12)} │ Missing Scripts`);
  console.log('─'.repeat(80));

  for (const result of results) {
    const status = result.hasRequiredScripts ? '✓ OK' : '✗ MISSING';
    const statusColor = result.hasRequiredScripts ? status : status;
    const missing = result.missingScripts.join(', ') || '—';

    console.log(
      `${result.name.padEnd(35)} │ ${statusColor.padEnd(12)} │ ${missing}`
    );
  }

  console.log('\n');
}

async function main(): Promise<void> {
  const allIssues: string[] = [];

  console.log('\n🔍 Validating Witylogix Workspace...\n');

  // Check 1: Package.json Scripts
  console.log('1️⃣  Checking package.json scripts...');
  const { results: scriptResults, issues: scriptIssues } = validatePackageJsonScripts();
  allIssues.push(...scriptIssues);

  if (scriptIssues.length === 0) {
    console.log('✓ All packages have required scripts');
  } else {
    scriptIssues.forEach(issue => console.log(issue));
  }

  // Check 2: .env.example
  console.log('\n2️⃣  Checking .env.example...');
  const envIssues = validateEnvExample();
  allIssues.push(...envIssues);

  if (envIssues.length === 0) {
    console.log('✓ .env.example is present and valid');
  } else {
    envIssues.forEach(issue => console.log(issue));
  }

  // Check 3: Dependency Versions
  console.log('\n3️⃣  Checking dependency versions...');
  const versionIssues = validateDependencyVersions();
  allIssues.push(...versionIssues);

  if (versionIssues.length === 0) {
    console.log('✓ No version mismatches detected');
  } else {
    versionIssues.forEach(issue => console.log(issue));
  }

  // Print summary table
  printTable(scriptResults);

  // Final result
  const hasErrors = scriptIssues.length > 0 || envIssues.length > 0;
  const hasWarnings = versionIssues.length > 0;

  if (hasErrors) {
    console.log('❌ Validation FAILED (errors found)\n');
    process.exit(1);
  }

  if (hasWarnings) {
    console.log('⚠️  Validation PASSED (with warnings)\n');
    process.exit(0);
  }

  console.log('✅ Validation PASSED (all checks clean)\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
