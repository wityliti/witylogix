import { readFileSync } from 'fs';
import { resolve } from 'path';

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  exports?: Record<string, any>;
  main?: string;
  module?: string;
  types?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface VerificationResult {
  package: string;
  hasBuildScript: boolean;
  hasTestScript: boolean;
  hasExports: boolean;
  hasTsupConfig: boolean;
  hasProperMainModule: boolean;
  hasProperTypes: boolean;
  errors: string[];
  warnings: string[];
}

const PACKAGES = [
  'framework',
  'types',
  'validators',
  'workflows',
  'carrier-service',
  'extension-core',
];

const REQUIRED_PACKAGES = new Set([
  'framework',
  'types',
  'validators',
  'workflows',
]);

function readPackageJson(packageName: string): PackageJson {
  const path = resolve(
    process.cwd(),
    `packages/${packageName}/package.json`
  );
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

function fileExists(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

function verifyPackage(packageName: string): VerificationResult {
  const result: VerificationResult = {
    package: packageName,
    hasBuildScript: false,
    hasTestScript: false,
    hasExports: false,
    hasTsupConfig: false,
    hasProperMainModule: false,
    hasProperTypes: false,
    errors: [],
    warnings: [],
  };

  try {
    const pkg = readPackageJson(packageName);

    // Check for build script
    result.hasBuildScript = Boolean(pkg.scripts?.build);
    if (!result.hasBuildScript) {
      result.errors.push(`Missing 'build' script in package.json`);
    }

    // Check for test script
    result.hasTestScript = Boolean(pkg.scripts?.test);
    if (!result.hasTestScript) {
      result.errors.push(`Missing 'test' script in package.json`);
    }

    // Check for exports field
    result.hasExports = Boolean(pkg.exports);
    if (!result.hasExports && REQUIRED_PACKAGES.has(packageName)) {
      result.errors.push(`Missing 'exports' field in package.json`);
    }

    // Check for proper main/module/types fields
    const hasMain = Boolean(pkg.main);
    const hasModule = Boolean(pkg.module);
    const hasTypes = Boolean(pkg.types);

    result.hasProperMainModule = hasMain && hasModule;
    result.hasProperTypes = hasTypes;

    if (!hasMain && REQUIRED_PACKAGES.has(packageName)) {
      result.warnings.push(`Missing 'main' field in package.json`);
    }
    if (!hasModule && REQUIRED_PACKAGES.has(packageName)) {
      result.warnings.push(`Missing 'module' field in package.json`);
    }
    if (!hasTypes) {
      result.warnings.push(`Missing 'types' field in package.json`);
    }

    // Check for tsup.config.ts
    const tsupConfigPath = resolve(
      process.cwd(),
      `packages/${packageName}/tsup.config.ts`
    );
    result.hasTsupConfig = fileExists(tsupConfigPath);
    if (!result.hasTsupConfig && REQUIRED_PACKAGES.has(packageName)) {
      result.errors.push(`Missing tsup.config.ts file`);
    }

    // Check for devDependencies
    if (REQUIRED_PACKAGES.has(packageName)) {
      const devDeps = pkg.devDependencies || {};
      if (!devDeps.tsup) {
        result.warnings.push(`Missing 'tsup' in devDependencies`);
      }
      if (!devDeps.vitest) {
        result.warnings.push(`Missing 'vitest' in devDependencies`);
      }
      if (!devDeps.typescript) {
        result.warnings.push(`Missing 'typescript' in devDependencies`);
      }
    }
  } catch (error) {
    result.errors.push(
      `Failed to read package: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

function checkCircularDependencies(): { hasCircular: boolean; details: string[] } {
  const details: string[] = [];
  const hasCircular = false;

  try {
    const dependencyGraph: Record<string, Set<string>> = {};

    // Build dependency graph
    for (const pkg of PACKAGES) {
      const packageJson = readPackageJson(pkg);
      dependencyGraph[pkg] = new Set();

      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      for (const depName in deps) {
        if (depName.startsWith('@witylogix/')) {
          const depPackage = depName.replace('@witylogix/', '');
          if (PACKAGES.includes(depPackage)) {
            dependencyGraph[pkg].add(depPackage);
          }
        }
      }
    }

    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function hasCycle(node: string, graph: Record<string, Set<string>>): boolean {
      visited.add(node);
      recursionStack.add(node);

      for (const neighbor of graph[node] || []) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor, graph)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          details.push(
            `Circular dependency detected: ${node} -> ${neighbor}`
          );
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    }

    for (const pkg of PACKAGES) {
      if (!visited.has(pkg)) {
        if (hasCycle(pkg, dependencyGraph)) {
          return { hasCircular: true, details };
        }
      }
    }
  } catch (error) {
    details.push(
      `Failed to check circular dependencies: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return { hasCircular, details };
}

function formatResult(result: VerificationResult): string {
  const status = result.errors.length === 0 ? '✓' : '✗';
  const lines = [`${status} ${result.package}`];

  if (result.hasBuildScript) {
    lines.push(`  ✓ Has build script`);
  }
  if (result.hasTestScript) {
    lines.push(`  ✓ Has test script`);
  }
  if (result.hasExports) {
    lines.push(`  ✓ Has exports field`);
  }
  if (result.hasTsupConfig) {
    lines.push(`  ✓ Has tsup.config.ts`);
  }
  if (result.hasProperMainModule) {
    lines.push(`  ✓ Has main and module fields`);
  }
  if (result.hasProperTypes) {
    lines.push(`  ✓ Has types field`);
  }

  if (result.errors.length > 0) {
    lines.push(`  Errors:`);
    result.errors.forEach(error => {
      lines.push(`    ✗ ${error}`);
    });
  }

  if (result.warnings.length > 0) {
    lines.push(`  Warnings:`);
    result.warnings.forEach(warning => {
      lines.push(`    ! ${warning}`);
    });
  }

  return lines.join('\n');
}

function main() {
  console.log('\n📦 Verifying Witylogix Packages\n');
  console.log('='.repeat(50));

  const results: VerificationResult[] = [];
  let allPassed = true;

  // Verify each package
  for (const packageName of PACKAGES) {
    const result = verifyPackage(packageName);
    results.push(result);
    console.log(formatResult(result));
    console.log();

    if (result.errors.length > 0) {
      allPassed = false;
    }
  }

  // Check for circular dependencies
  console.log('='.repeat(50));
  console.log('\n🔄 Checking for Circular Dependencies\n');
  const circularCheck = checkCircularDependencies();

  if (circularCheck.hasCircular) {
    console.log('✗ Circular dependencies detected:');
    circularCheck.details.forEach(detail => {
      console.log(`  ${detail}`);
    });
    allPassed = false;
  } else {
    console.log('✓ No circular dependencies detected');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  const passedCount = results.filter(r => r.errors.length === 0).length;
  console.log(
    `\nSummary: ${passedCount}/${results.length} packages passed verification`
  );

  if (allPassed) {
    console.log('\n✓ All checks passed!\n');
    process.exit(0);
  } else {
    console.log('\n✗ Some checks failed. Please fix the issues above.\n');
    process.exit(1);
  }
}

main();
