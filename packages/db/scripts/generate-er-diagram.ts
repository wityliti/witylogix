#!/usr/bin/env ts-node

/**
 * Generate Mermaid ER diagrams from Prisma schema
 *
 * Usage:
 *   pnpm exec ts-node scripts/generate-er-diagram.ts [--output docs/database/ER_AUTO.md] [--filter core,auth,billing]
 *
 * Options:
 *   --output <path>    Output file (default: docs/database/ER_AUTO.md)
 *   --filter <modules> Comma-separated module names to include (e.g., core, auth, billing)
 *   --grouped          Generate one diagram per module (default: false)
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

interface PrismaModel {
  name: string;
  fields: PrismaField[];
  relations: string[]; // Names of other models this relates to
  module: string; // e.g., "core", "auth", "billing"
}

interface PrismaField {
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  isUnique: boolean;
  isPrimary: boolean;
  default?: string;
  relation?: {
    targetModel: string;
    relationName?: string;
    isOneToOne: boolean;
  };
}

interface Relationship {
  from: string;
  to: string;
  fromCardinality: "one" | "many";
  toCardinality: "one" | "many";
  relationName: string;
}

const SCHEMA_DIR = path.join(__dirname, "../prisma/schema");
const DEFAULT_OUTPUT = path.join(__dirname, "../../docs/database/ER_AUTO.md");

// Module classification based on file prefix
const MODULE_MAP: { [key: string]: string } = {
  "00": "config",
  "01": "core",
  "02": "core",
  "03": "core",
  "04": "orders",
  "05": "fleet",
  "06": "delivery",
  "07": "delivery",
  "08": "messaging",
  "09": "carrier",
  "10": "metering",
  "11": "integrations",
  "20": "locations",
  "21": "shipping",
  "22": "shipping",
  "23": "messaging",
  "24": "payments",
  "25": "cache",
  "26": "integrations",
  "27": "delivery",
  "28": "inventory",
  "29": "metafields",
  "30": "webhooks",
  "33": "messaging",
  "34": "campaigns",
  "35": "billing",
  "36": "shipping",
  "38": "views",
  "39": "auth",
  "40": "pos",
  "41": "auth",
  "42": "pos",
  "43": "delivery",
  "44": "delivery",
  "45": "billing",
  "46": "fleet",
  "48": "billing",
  "49": "crm",
  "50": "erp",
  "60": "auth",
  "61": "onboarding",
  "62": "tenant",
};

function getModule(filename: string): string {
  const prefix = filename.substring(0, 2);
  return MODULE_MAP[prefix] || "other";
}

async function parsePrismaSchemas(): Promise<Map<string, PrismaModel>> {
  const models = new Map<string, PrismaModel>();

  // Read all .prisma files
  const files = fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".prisma"));

  for (const file of files) {
    const filePath = path.join(SCHEMA_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");

    // Simple regex-based parser for Prisma models
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = modelRegex.exec(content)) !== null) {
      const modelName = match[1];
      const modelBody = match[2];
      const module = getModule(file);

      const fields = parseFields(modelBody);
      const relations = extractRelationTargets(fields);

      models.set(modelName, {
        name: modelName,
        fields,
        relations,
        module,
      });
    }
  }

  return models;
}

function parseFields(modelBody: string): PrismaField[] {
  const fields: PrismaField[] = [];
  const fieldRegex =
    /(\w+)\s+(\w+(?:\[\])?|\w+\?)\s*(@[\w\s():".,]*)?(?:@[\w\s():".,]*)*\s*\/\/\s*(.*)?\n/g;

  // Simpler regex to match field lines
  const lines = modelBody.split("\n").filter((l) => l.trim() && !l.includes("@@"));

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;

    const parts = trimmed.match(
      /^\s*(\w+)\s+([A-Z]\w+(\[\])?(\?)?)\s*(.*)/
    );
    if (!parts) continue;

    const [, fieldName, fieldType, isList, optional] = parts;
    const isRequired = !optional;

    fields.push({
      name: fieldName,
      type: fieldType,
      isRequired,
      isList: !!isList,
      isUnique: trimmed.includes("@unique"),
      isPrimary: trimmed.includes("@id"),
    });
  }

  return fields;
}

function extractRelationTargets(fields: PrismaField[]): string[] {
  const targets = new Set<string>();

  for (const field of fields) {
    // Check if type looks like a model reference (PascalCase type that's not a built-in)
    if (/^[A-Z][a-zA-Z0-9]*\??$/.test(field.type)) {
      const modelName = field.type.replace("?", "").replace("[]", "");
      if (!isBuiltInType(modelName)) {
        targets.add(modelName);
      }
    }
  }

  return Array.from(targets);
}

function isBuiltInType(type: string): boolean {
  const builtins = [
    "String",
    "Int",
    "Boolean",
    "Float",
    "DateTime",
    "BigInt",
    "Decimal",
    "Bytes",
    "Json",
    "UUID",
    "Date",
  ];
  return builtins.includes(type);
}

function inferRelationships(models: Map<string, PrismaModel>): Relationship[] {
  const relationships: Relationship[] = [];
  const seen = new Set<string>();

  for (const [modelName, model] of models.entries()) {
    for (const relationTarget of model.relations) {
      if (!models.has(relationTarget)) continue;

      const key = [modelName, relationTarget].sort().join("-");
      if (seen.has(key)) continue;
      seen.add(key);

      const targetModel = models.get(relationTarget)!;

      // Find corresponding fields in both models
      const backRef = targetModel.relations.includes(modelName);

      relationships.push({
        from: modelName,
        to: relationTarget,
        fromCardinality: "many",
        toCardinality: backRef ? "many" : "one",
        relationName: `relates to`,
      });
    }
  }

  return relationships;
}

function generateMermaidDiagram(
  models: Map<string, PrismaModel>,
  relationships: Relationship[],
  filter?: string
): string {
  const filterSet = filter ? new Set(filter.split(",").map((s) => s.trim())) : null;

  let output = "```mermaid\nerDiagram\n";

  // Filter models if needed
  const filteredModels = new Map(
    Array.from(models.entries()).filter(([, model]) => {
      if (!filterSet) return true;
      return filterSet.has(model.module);
    })
  );

  // Add relationships
  for (const rel of relationships) {
    if (!filteredModels.has(rel.from) || !filteredModels.has(rel.to)) continue;

    const fromCard = rel.fromCardinality === "one" ? "||" : "o{";
    const toCard = rel.toCardinality === "one" ? "||" : "}o";

    output += `    ${rel.from} ${fromCard}--${toCard} ${rel.to} : "${rel.relationName}"\n`;
  }

  // Add model definitions
  for (const [, model] of filteredModels.entries()) {
    output += `\n    ${model.name} {\n`;

    for (const field of model.fields) {
      const marker = field.isPrimary ? "PK" : field.isUnique ? "UK" : "";
      const nullable = !field.isRequired ? "?" : "";
      const isList = field.isList ? "[]" : "";

      output += `        ${field.type}${isList} ${field.name} ${nullable} ${marker}\n`.trim();
      output += "\n";
    }

    output += "    }\n";
  }

  output += "```\n";
  return output;
}

function generateGroupedDiagrams(
  models: Map<string, PrismaModel>,
  relationships: Relationship[]
): string {
  let output = "# Entity Relationship Diagrams (Auto-Generated)\n\n";

  // Group by module
  const moduleGroups = new Map<string, PrismaModel[]>();
  for (const [, model] of models.entries()) {
    if (!moduleGroups.has(model.module)) {
      moduleGroups.set(model.module, []);
    }
    moduleGroups.get(model.module)!.push(model);
  }

  // Generate diagram per module
  for (const [module, moduleModels] of moduleGroups.entries()) {
    output += `## Module: ${module.toUpperCase()}\n\n`;

    const moduleModelSet = new Set(moduleModels.map((m) => m.name));
    const moduleRelationships = relationships.filter(
      (r) => moduleModelSet.has(r.from) || moduleModelSet.has(r.to)
    );

    output += generateMermaidDiagram(
      new Map(moduleModels.map((m) => [m.name, m])),
      moduleRelationships
    );

    output += "\n";
  }

  return output;
}

async function main() {
  const args = process.argv.slice(2);
  let outputPath = DEFAULT_OUTPUT;
  let filter: string | undefined;
  let grouped = false;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) {
      outputPath = args[++i];
    } else if (args[i] === "--filter" && args[i + 1]) {
      filter = args[++i];
    } else if (args[i] === "--grouped") {
      grouped = true;
    }
  }

  try {
    console.log("Parsing Prisma schemas...");
    const models = await parsePrismaSchemas();
    console.log(`Found ${models.size} models`);

    const relationships = inferRelationships(models);
    console.log(`Found ${relationships.length} relationships`);

    let output: string;

    if (grouped) {
      console.log("Generating grouped diagrams...");
      output = generateGroupedDiagrams(models, relationships);
    } else {
      console.log("Generating unified diagram...");
      output =
        `# Entity Relationship Diagram (Auto-Generated)\n\n` +
        `Generated: ${new Date().toISOString()}\n\n` +
        generateMermaidDiagram(models, relationships, filter);
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(outputPath, output, "utf-8");
    console.log(`✓ Diagram written to ${outputPath}`);
  } catch (error) {
    console.error("Error generating ER diagram:", error);
    process.exit(1);
  }
}

main();
