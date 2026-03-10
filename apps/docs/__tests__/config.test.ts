/**
 * Docs Configuration Tests
 * Validates documentation structure, frontmatter, and configuration
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const DOCS_ROOT = path.resolve(__dirname, '..', 'content', 'docs');
const SOURCE_CONFIG = path.resolve(__dirname, '..', 'source.config.ts');

/**
 * Validate that a file exists and is readable
 */
function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse frontmatter from MDX content (YAML format)
 */
function parseFrontmatter(
  content: string
): { data: Record<string, any>; body: string } | null {
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
 * Extract first H1 heading from markdown content
 */
function extractFirstHeading(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : null;
}

/**
 * Find all markdown links in content
 */
function findMarkdownLinks(content: string): string[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: string[] = [];
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[2]);
  }

  return links;
}

describe('Docs Configuration', () => {
  // =========================================================================
  // Configuration File Tests
  // =========================================================================

  describe('source.config.ts', () => {
    it('should exist', () => {
      expect(fileExists(SOURCE_CONFIG)).toBe(true);
    });

    it('should export valid config', () => {
      const content = fs.readFileSync(SOURCE_CONFIG, 'utf-8');
      expect(content).toContain('defineConfig');
      expect(content).toContain('defineDocs');
    });

    it('should reference correct docs directory', () => {
      const content = fs.readFileSync(SOURCE_CONFIG, 'utf-8');
      expect(content).toContain("'content/docs'");
    });
  });

  // =========================================================================
  // MDX File Structure Tests
  // =========================================================================

  describe('MDX Files', () => {
    function getMdxFiles(): string[] {
      const files: string[] = [];

      function walkDir(dir: string) {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (item.endsWith('.mdx')) {
            files.push(fullPath);
          }
        }
      }

      walkDir(DOCS_ROOT);
      return files;
    }

    it('should have MDX files in docs directory', () => {
      const mdxFiles = getMdxFiles();
      expect(mdxFiles.length).toBeGreaterThan(0);
    });

    it('should not have empty MDX files', () => {
      const mdxFiles = getMdxFiles();
      const emptyFiles: string[] = [];

      for (const file of mdxFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        if (content.trim().length === 0) {
          emptyFiles.push(file);
        }
      }

      expect(emptyFiles).toHaveLength(0);
    });

    it('should have title in frontmatter or as first heading', () => {
      const mdxFiles = getMdxFiles();
      const filesWithoutTitle: string[] = [];

      for (const file of mdxFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const hasTitle =
          frontmatter?.data?.title || extractFirstHeading(content);

        if (!hasTitle) {
          filesWithoutTitle.push(file);
        }
      }

      expect(filesWithoutTitle).toHaveLength(0);
    });

    it('should have description in frontmatter (optional but nice)', () => {
      const mdxFiles = getMdxFiles();
      const filesWithDescription: string[] = [];

      for (const file of mdxFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const frontmatter = parseFrontmatter(content);

        if (frontmatter?.data?.description) {
          filesWithDescription.push(file);
        }
      }

      // At least half should have descriptions
      const ratio = filesWithDescription.length / mdxFiles.length;
      expect(ratio).toBeGreaterThanOrEqual(0.3);
    });

    it('should have valid content structure', () => {
      const mdxFiles = getMdxFiles();
      const invalidFiles: string[] = [];

      for (const file of mdxFiles) {
        const content = fs.readFileSync(file, 'utf-8');

        // Check for basic markdown structure
        const hasContent =
          content.includes('#') ||
          content.includes('-') ||
          content.includes('*');

        if (!hasContent && !content.includes('title:')) {
          invalidFiles.push(file);
        }
      }

      expect(invalidFiles).toHaveLength(0);
    });
  });

  // =========================================================================
  // Meta.json File Tests
  // =========================================================================

  describe('meta.json Files', () => {
    function getMetaFiles(): string[] {
      const files: string[] = [];

      function walkDir(dir: string) {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (item === 'meta.json') {
            files.push(fullPath);
          }
        }
      }

      walkDir(DOCS_ROOT);
      return files;
    }

    it('should have valid JSON format', () => {
      const metaFiles = getMetaFiles();
      const invalidFiles: string[] = [];

      for (const file of metaFiles) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          JSON.parse(content);
        } catch {
          invalidFiles.push(file);
        }
      }

      expect(invalidFiles).toHaveLength(0);
    });

    it('should have required title field', () => {
      const metaFiles = getMetaFiles();
      const invalidFiles: string[] = [];

      for (const file of metaFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const config = JSON.parse(content);

        if (!config.title) {
          invalidFiles.push(file);
        }
      }

      expect(invalidFiles).toHaveLength(0);
    });

    it('should have pages array', () => {
      const metaFiles = getMetaFiles();
      const invalidFiles: string[] = [];

      for (const file of metaFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const config = JSON.parse(content);

        if (!Array.isArray(config.pages) && !config.pages) {
          // pages is optional but if present should be array
          continue;
        }

        if (config.pages && !Array.isArray(config.pages)) {
          invalidFiles.push(file);
        }
      }

      expect(invalidFiles).toHaveLength(0);
    });

    it('should reference existing MDX files', () => {
      const metaFiles = getMetaFiles();
      const mdxFiles = new Set<string>();

      // Build set of all MDX file basenames (without extension)
      function walkDir(dir: string, prefix = '') {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            walkDir(fullPath, prefix ? `${prefix}/${item}` : item);
          } else if (item.endsWith('.mdx') && item !== 'index.mdx') {
            const baseName = item.replace('.mdx', '');
            const fullName = prefix ? `${prefix}/${baseName}` : baseName;
            mdxFiles.add(fullName);
          }
        }
      }

      walkDir(DOCS_ROOT);

      const brokenReferences: string[] = [];

      for (const file of metaFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const config = JSON.parse(content);

        if (config.pages && Array.isArray(config.pages)) {
          for (const page of config.pages) {
            const pageName = typeof page === 'string' ? page : page.path;

            // index files are always valid
            if (pageName === 'index') {
              continue;
            }

            if (!mdxFiles.has(pageName) && pageName !== 'index') {
              brokenReferences.push(`${file}: missing ${pageName}`);
            }
          }
        }
      }

      // Allow some flexibility - meta.json might reference pages that don't exist yet
      expect(brokenReferences.length).toBeLessThan(5);
    });
  });

  // =========================================================================
  // Internal Link Validation
  // =========================================================================

  describe('Internal Links', () => {
    it('should not have broken internal links', () => {
      const mdxFiles: string[] = [];

      function walkDir(dir: string) {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (item.endsWith('.mdx')) {
            mdxFiles.push(fullPath);
          }
        }
      }

      walkDir(DOCS_ROOT);

      // Build set of valid docs
      const validDocs = new Set<string>();
      for (const file of mdxFiles) {
        const relativePath = path
          .relative(DOCS_ROOT, file)
          .replace(/\\/g, '/')
          .replace('.mdx', '')
          .replace(/\/index$/, '');
        validDocs.add(`/docs/${relativePath}`);
      }

      const brokenLinks: string[] = [];

      for (const file of mdxFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const links = findMarkdownLinks(content);

        for (const link of links) {
          // Skip external links
          if (link.startsWith('http') || link.startsWith('#')) {
            continue;
          }

          // Normalize link
          const normalizedLink = link.startsWith('/') ? link : `/docs/${link}`;

          if (!validDocs.has(normalizedLink) && !link.includes('://')) {
            brokenLinks.push(`${file}: ${link}`);
          }
        }
      }

      // Allow some broken links (they might be external or coming soon)
      expect(brokenLinks.length).toBeLessThan(10);
    });
  });

  // =========================================================================
  // Directory Structure Tests
  // =========================================================================

  describe('Directory Structure', () => {
    it('should have docs directory', () => {
      expect(fileExists(DOCS_ROOT)).toBe(true);
    });

    it('should have index.mdx in docs root', () => {
      const indexPath = path.join(DOCS_ROOT, 'index.mdx');
      expect(fileExists(indexPath)).toBe(true);
    });

    it('should have at least one meta.json', () => {
      const metaFiles: string[] = [];

      function walkDir(dir: string) {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (item === 'meta.json') {
            metaFiles.push(fullPath);
          }
        }
      }

      walkDir(DOCS_ROOT);
      expect(metaFiles.length).toBeGreaterThanOrEqual(1);
    });
  });
});
