#!/usr/bin/env node

/**
 * Validate Docs Script
 *
 * Scans all MDX files in apps/docs/content/ and validates:
 * - Each file has a title (in frontmatter or as first heading)
 * - No empty files
 * - meta.json files reference existing MDX files
 * - Reports any broken references
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - Issues found
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  passed: number;
  failed: number;
  errors: string[];
  warnings: string[];
}

const DOCS_ROOT = path.resolve(__dirname, '..', 'apps', 'docs', 'content');

// Color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

/**
 * Parse YAML frontmatter from MDX content
 */
function parseFrontmatter(content: string): {
  data: Record<string, any>;
  body: string;
} | null {
  if (!content.startsWith('---')) {
    return null;
  }

  const lines = content.split('\n');
  let endIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return null;
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const data: Record<string, any> = {};

  for (const line of frontmatterLines) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value: any = match[2].trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      data[key] = value;
    }
  }

  const body = lines.slice(endIndex + 1).join('\n').trim();
  return { data, body };
}

/**
 * Extract first H1 heading from markdown
 */
function extractFirstHeading(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : null;
}

/**
 * Get all MDX files in directory
 */
function getMdxFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(current: string) {
    const items = fs.readdirSync(current);

    for (const item of items) {
      const fullPath = path.join(current, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (item.endsWith('.mdx')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Get all meta.json files
 */
function getMetaFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(current: string) {
    const items = fs.readdirSync(current);

    for (const item of items) {
      const fullPath = path.join(current, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (item === 'meta.json') {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Validate individual MDX file
 */
function validateMdxFile(
  filePath: string,
  result: ValidationResult
): { title: string | null } {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for empty files
    if (content.trim().length === 0) {
      result.errors.push(`❌ Empty file: ${filePath}`);
      result.failed++;
      return { title: null };
    }

    // Parse frontmatter and extract title
    const frontmatter = parseFrontmatter(content);
    const title =
      frontmatter?.data?.title || extractFirstHeading(content);

    if (!title) {
      result.errors.push(
        `❌ No title found in: ${filePath}\n   Add title to frontmatter or as first # heading`
      );
      result.failed++;
      return { title: null };
    }

    result.passed++;
    return { title };
  } catch (error: any) {
    result.errors.push(`❌ Error reading file: ${filePath}\n   ${error.message}`);
    result.failed++;
    return { title: null };
  }
}

/**
 * Validate meta.json references
 */
function validateMetaJson(
  filePath: string,
  mdxFiles: Set<string>,
  result: ValidationResult
) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content);

    if (!config.title) {
      result.warnings.push(
        `⚠ No title in meta.json: ${filePath}`
      );
    }

    if (config.pages && Array.isArray(config.pages)) {
      for (const page of config.pages) {
        const pageName = typeof page === 'string' ? page : page.path;

        // Skip index pages - always valid
        if (pageName === 'index') {
          continue;
        }

        // Check if referenced MDX file exists
        if (!mdxFiles.has(pageName)) {
          result.warnings.push(
            `⚠ Meta references missing file: ${filePath} -> ${pageName}.mdx`
          );
        }
      }
    }
  } catch (error: any) {
    result.errors.push(
      `❌ Invalid meta.json: ${filePath}\n   ${error.message}`
    );
    result.failed++;
  }
}

/**
 * Main validation logic
 */
function validateDocs(): ValidationResult {
  const result: ValidationResult = {
    passed: 0,
    failed: 0,
    errors: [],
    warnings: [],
  };

  console.log(`${COLORS.blue}=================================================================================${COLORS.reset}`);
  console.log(`${COLORS.blue}Documentation Validation${COLORS.reset}`);
  console.log(`${COLORS.blue}=================================================================================${COLORS.reset}`);
  console.log();

  // Check if docs directory exists
  if (!fs.existsSync(DOCS_ROOT)) {
    console.error(`${COLORS.red}Error: Docs directory not found at ${DOCS_ROOT}${COLORS.reset}`);
    result.failed++;
    return result;
  }

  // Get all MDX files
  const mdxFiles = getMdxFiles(DOCS_ROOT);
  console.log(`Found ${mdxFiles.length} MDX files`);

  // Build set of valid MDX file basenames
  const mdxFileSet = new Set<string>();
  for (const file of mdxFiles) {
    const relativePath = path
      .relative(DOCS_ROOT, file)
      .replace(/\\/g, '/')
      .replace('.mdx', '');

    mdxFileSet.add(relativePath);
  }

  // Validate each MDX file
  console.log(`${COLORS.blue}→ Validating MDX files...${COLORS.reset}`);
  for (const file of mdxFiles) {
    validateMdxFile(file, result);
  }
  console.log();

  // Validate meta.json files
  const metaFiles = getMetaFiles(DOCS_ROOT);
  console.log(`Found ${metaFiles.length} meta.json files`);
  console.log(`${COLORS.blue}→ Validating meta.json files...${COLORS.reset}`);
  for (const file of metaFiles) {
    validateMetaJson(file, mdxFileSet, result);
  }
  console.log();

  // Print results
  console.log(`${COLORS.blue}=================================================================================${COLORS.reset}`);
  console.log(`Validation Results`);
  console.log(`${COLORS.blue}=================================================================================${COLORS.reset}`);
  console.log(`${COLORS.green}Passed: ${result.passed}${COLORS.reset}`);

  if (result.failed > 0) {
    console.log(`${COLORS.red}Failed: ${result.failed}${COLORS.reset}`);
  }

  if (result.warnings.length > 0) {
    console.log(`${COLORS.yellow}Warnings: ${result.warnings.length}${COLORS.reset}`);
  }

  console.log();

  // Print errors
  if (result.errors.length > 0) {
    console.log(`${COLORS.red}Errors:${COLORS.reset}`);
    for (const error of result.errors) {
      console.log(`  ${error}`);
    }
    console.log();
  }

  // Print warnings
  if (result.warnings.length > 0) {
    console.log(`${COLORS.yellow}Warnings:${COLORS.reset}`);
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
    console.log();
  }

  console.log(`${COLORS.blue}=================================================================================${COLORS.reset}`);

  return result;
}

/**
 * Entry point
 */
const result = validateDocs();

if (result.failed === 0) {
  console.log(`${COLORS.green}✅ All documentation validations passed!${COLORS.reset}`);
  console.log();
  process.exit(0);
} else {
  console.log(`${COLORS.red}❌ Documentation validation failed. Please fix the errors above.${COLORS.reset}`);
  console.log();
  process.exit(1);
}
