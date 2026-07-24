import fs from "fs";
import path from "path";
import { glob } from "glob";

/**
 * Translation key extraction script
 * Scans all .tsx/.ts files for useTranslations and t() calls
 * Reports missing keys per locale
 */

interface ExtractionResult {
  totalKeys: number;
  keysByFile: Record<string, string[]>;
  missingByLocale: Record<string, string[]>;
}

const TRANSLATION_PATTERNS = [
  /useTranslations\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, // useTranslations('key')
  /t\s*\(\s*['"`]([^'"`]+)['"`]/g, // t('key')
  /t\s*:\s*['"`]([^'"`]+)['"`]/g, // t: 'key' (in objects)
];

async function extractKeysFromFiles(): Promise<ExtractionResult> {
  const srcDir = path.join(process.cwd(), "src");
  const allTsxFiles = await glob(path.join(srcDir, "**/*.{tsx,ts}"));
  const tsxFiles = allTsxFiles.filter(
    (f) =>
      !f.includes("node_modules") &&
      !f.includes(".next") &&
      !f.includes("__tests__"),
  );

  const keysByFile: Record<string, string[]> = {};
  const allKeys = new Set<string>();

  for (const file of tsxFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const keys: string[] = [];

    for (const pattern of TRANSLATION_PATTERNS) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const key = match[1];
        if (key && !keys.includes(key)) {
          keys.push(key);
          allKeys.add(key);
        }
      }
    }

    if (keys.length > 0) {
      const relativePath = path.relative(srcDir, file);
      keysByFile[relativePath] = keys;
    }
  }

  // Load translation files
  const messagesDir = path.join(process.cwd(), "messages");
  const locales = ["en", "es", "fr"];
  const translations: Record<string, Set<string>> = {};

  for (const locale of locales) {
    const filePath = path.join(messagesDir, `${locale}.json`);
    if (fs.existsSync(filePath)) {
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      translations[locale] = new Set(flattenKeys(content));
    }
  }

  // Find missing keys
  const missingByLocale: Record<string, string[]> = {};
  for (const locale of locales) {
    const translationKeys = translations[locale] || new Set();
    const missing = Array.from(allKeys).filter(
      (key) => !translationKeys.has(key),
    );
    if (missing.length > 0) {
      missingByLocale[locale] = missing;
    }
  }

  return {
    totalKeys: allKeys.size,
    keysByFile,
    missingByLocale,
  };
}

function flattenKeys(obj: any, prefix = ""): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

async function generateReport(): Promise<void> {
  console.log("Extracting translation keys...\n");

  const result = await extractKeysFromFiles();

  console.log(`Total unique keys found: ${result.totalKeys}\n`);

  if (Object.keys(result.keysByFile).length > 0) {
    console.log("Keys by file:");
    for (const [file, keys] of Object.entries(result.keysByFile)) {
      console.log(`  ${file}: ${keys.length} keys`);
      keys.slice(0, 3).forEach((k) => console.log(`    - ${k}`));
      if (keys.length > 3) console.log(`    ... and ${keys.length - 3} more`);
    }
    console.log();
  }

  if (Object.keys(result.missingByLocale).length > 0) {
    console.log("Missing translations:");
    for (const [locale, keys] of Object.entries(result.missingByLocale)) {
      console.log(`  ${locale}: ${keys.length} missing keys`);
      keys.slice(0, 5).forEach((k) => console.log(`    - ${k}`));
      if (keys.length > 5) console.log(`    ... and ${keys.length - 5} more`);
    }
    console.log();
  } else {
    console.log("All translation keys are present in all locales.\n");
  }

  // Write detailed JSON report
  const reportPath = path.join(process.cwd(), "i18n-extraction-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(`Detailed report saved to: ${reportPath}`);
}

// Run if executed directly
if (require.main === module) {
  generateReport().catch(console.error);
}

export { extractKeysFromFiles, generateReport };
