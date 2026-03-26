import { describe, it, expect, beforeEach, vi } from 'vitest';
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

// Mock implementation of the verification functions
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

describe('Package Verification', () => {
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

  describe('Build and Test Scripts', () => {
    it('should have build script for all packages', () => {
      for (const pkg of PACKAGES) {
        const packageJson = readPackageJson(pkg);
        expect(
          packageJson.scripts?.build,
          `${pkg} should have a build script`
        ).toBeDefined();
      }
    });

    it('should have test script for all packages', () => {
      for (const pkg of PACKAGES) {
        const packageJson = readPackageJson(pkg);
        expect(
          packageJson.scripts?.test,
          `${pkg} should have a test script`
        ).toBeDefined();
      }
    });

    it('build script should use tsup for required packages', () => {
      for (const pkg of REQUIRED_PACKAGES) {
        const packageJson = readPackageJson(pkg);
        const buildScript = packageJson.scripts?.build || '';
        expect(
          buildScript.includes('tsup'),
          `${pkg} build script should use tsup`
        ).toBe(true);
      }
    });

    it('test script should use vitest for all packages', () => {
      for (const pkg of PACKAGES) {
        const packageJson = readPackageJson(pkg);
        const testScript = packageJson.scripts?.test || '';
        expect(
          testScript.includes('vitest'),
          `${pkg} test script should use vitest`
        ).toBe(true);
      }
    });
  });

  describe('Package Exports', () => {
    it('required packages should have exports field', () => {
      for (const pkg of REQUIRED_PACKAGES) {
        const packageJson = readPackageJson(pkg);
        expect(
          packageJson.exports,
          `${pkg} should have exports field`
        ).toBeDefined();
      }
    });

    it('exports should have proper structure with import/require/types', () => {
      for (const pkg of REQUIRED_PACKAGES) {
        const packageJson = readPackageJson(pkg);
        const exports = packageJson.exports || {};

        if (typeof exports === 'object' && !Array.isArray(exports)) {
          const mainExport = exports['.'];
          if (typeof mainExport === 'object') {
            expect(
              mainExport.import || mainExport.require,
              `${pkg} main export should have import or require`
            ).toBeDefined();
            expect(
              mainExport.types,
              `${pkg} main export should have types`
            ).toBeDefined();
          }
        }
      }
    });
  });

  describe('Package Configuration', () => {
    it('required packages should have main field', () => {
      for (const pkg of REQUIRED_PACKAGES) {
        const packageJson = readPackageJson(pkg);
        expect(
          packageJson.main,
          `${pkg} should have main field`
        ).toBeDefined();
      }
    });

    it('required packages should have module field', () => {
      for (const pkg of REQUIRED_PACKAGES) {
        const packageJson = readPackageJson(pkg);
        expect(
          packageJson.module,
          `${pkg} should have module field`
        ).toBeDefined();
      }
    });

    it('all packages should have types field', () => {
      for (const pkg of PACKAGES) {
        const packageJson = readPackageJson(pkg);
        expect(
          packageJson.types,
          `${pkg} should have types field`
        ).toBeDefined();
      }
    });

    it('required packages should point to dist directory', () => {
      for (const pkg of REQUIRED_PACKAGES) {
        const packageJson = readPackageJson(pkg);
        if (packageJson.main) {
          expect(
            packageJson.main.startsWith('dist/'),
            `${pkg} main should point to dist directory`
          ).toBe(true);
        }
        if (packageJson.module) {
          expect(
            packageJson.module.startsWith('dist/'),
            `${pkg} module should point to dist directory`
          ).toBe(true);
        }
        if (packageJson.types) {
          expect(
            packageJson.types.startsWith('dist/'),
            `${pkg} types should point to dist directory`
          ).toBe(true);
        }
      }
    });
  });

  describe('Build Configuration', () => {
    it('required packages should have tsup.config.ts', () => {
      for (const pkg of REQUIRED_PACKAGES) {
        const tsupConfigPath = resolve(
          process.cwd(),
          `packages/${pkg}/tsup.config.ts`
        );
        expect(
          fileExists(tsupConfigPath),
          `${pkg} should have tsup.config.ts`
        ).toBe(true);
      }
    });
  });

  describe('DevDependencies', () => {
    it('required packages should have tsup in devDependencies', () => {
      for (const pkg of REQUIRED_PACKAGES) {
        const packageJson = readPackageJson(pkg);
        expect(
          packageJson.devDependencies?.tsup,
          `${pkg} should have tsup in devDependencies`
        ).toBeDefined();
      }
    });

    it('all packages should have vitest in devDependencies', () => {
      for (const pkg of PACKAGES) {
        const packageJson = readPackageJson(pkg);
        expect(
          packageJson.devDependencies?.vitest,
          `${pkg} should have vitest in devDependencies`
        ).toBeDefined();
      }
    });

    it('required packages should have typescript in devDependencies', () => {
      for (const pkg of REQUIRED_PACKAGES) {
        const packageJson = readPackageJson(pkg);
        expect(
          packageJson.devDependencies?.typescript,
          `${pkg} should have typescript in devDependencies`
        ).toBeDefined();
      }
    });
  });

  describe('Dependency Integrity', () => {
    it('should not have missing dependencies', () => {
      for (const pkg of PACKAGES) {
        const packageJson = readPackageJson(pkg);
        const deps = { ...packageJson.dependencies };

        for (const depName in deps) {
          if (depName.startsWith('@witylogix/')) {
            const depPackage = depName.replace('@witylogix/', '');
            const depPath = resolve(
              process.cwd(),
              `packages/${depPackage}/package.json`
            );
            expect(
              fileExists(depPath),
              `${pkg} depends on ${depName} which should exist`
            ).toBe(true);
          }
        }
      }
    });

    it('framework should depend on db and types', () => {
      const framework = readPackageJson('framework');
      expect(framework.dependencies?.['@witylogix/db']).toBeDefined();
      expect(framework.dependencies?.['@witylogix/types']).toBeDefined();
    });

    it('workflows should depend on db, types, and core', () => {
      const workflows = readPackageJson('workflows');
      expect(workflows.dependencies?.['@witylogix/db']).toBeDefined();
      expect(workflows.dependencies?.['@witylogix/types']).toBeDefined();
      expect(workflows.dependencies?.['@witylogix/core']).toBeDefined();
    });
  });

  describe('Package Metadata', () => {
    it('all packages should be private', () => {
      for (const pkg of PACKAGES) {
        const packageJson = readPackageJson(pkg);
        expect(
          packageJson.private,
          `${pkg} should be marked as private`
        ).toBe(true);
      }
    });

    it('all packages should be ES modules', () => {
      for (const pkg of PACKAGES) {
        const packageJson = readPackageJson(pkg);
        // Note: Not all packages explicitly set "type": "module" if using default module resolution
        // But they should use ESM syntax in their source
        if (pkg !== 'carrier-service' && pkg !== 'extension-core') {
          expect(
            packageJson.type === 'module',
            `${pkg} should have "type": "module"`
          ).toBe(true);
        }
      }
    });
  });

  describe('Export Entry Points', () => {
    it('framework should export all submodules', () => {
      const framework = readPackageJson('framework');
      const exports = framework.exports || {};

      expect(exports['.'], 'framework should export root').toBeDefined();
      expect(exports['./workflow'], 'framework should export ./workflow').toBeDefined();
      expect(exports['./container'], 'framework should export ./container').toBeDefined();
      expect(exports['./types'], 'framework should export ./types').toBeDefined();
      expect(exports['./queue'], 'framework should export ./queue').toBeDefined();
    });

    it('workflows should export steps and definitions', () => {
      const workflows = readPackageJson('workflows');
      const exports = workflows.exports || {};

      expect(exports['.'], 'workflows should export root').toBeDefined();
      expect(exports['./steps'], 'workflows should export ./steps').toBeDefined();
      expect(exports['./definitions'], 'workflows should export ./definitions').toBeDefined();
    });
  });
});
