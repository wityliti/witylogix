/**
 * Environment Variable Validator
 *
 * Reads .env.example as the template for required/optional vars.
 * Validates that all required vars are set in process.env.
 * Groups vars into: Required, Optional, Development-only.
 * Provides helpful error messages for missing vars.
 */

import * as fs from "fs";
import * as path from "path";

interface EnvVar {
  name: string;
  value: string | undefined;
  description: string;
}

interface EnvCategory {
  required: EnvVar[];
  optional: EnvVar[];
  development: EnvVar[];
}

// Color helpers
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

/**
 * Parse .env.example file and extract variable names and descriptions
 */
function parseEnvExample(filePath: string): Map<string, string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`.env.example not found at ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const envVars = new Map<string, string>();
  const lines = content.split("\n");

  let currentDescription = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Capture comment lines as descriptions
    if (trimmed.startsWith("#")) {
      currentDescription = trimmed.replace(/^#+\s*/, "").trim();
      continue;
    }

    // Extract variable name from assignment
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) {
      const varName = match[1];
      envVars.set(varName, currentDescription);
      currentDescription = "";
    }
  }

  return envVars;
}

/**
 * Categorize environment variables by requirement level
 */
function categorizeEnvVars(envVars: Map<string, string>): EnvCategory {
  const requiredVars = [
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_SECRET",
  ];

  const developmentOnlyVars = [
    "DEBUG",
    "LOG_LEVEL",
  ];

  const required: EnvVar[] = [];
  const optional: EnvVar[] = [];
  const development: EnvVar[] = [];

  for (const [name, description] of envVars) {
    const value = process.env[name];

    const envVar: EnvVar = {
      name,
      value,
      description,
    };

    if (requiredVars.includes(name)) {
      required.push(envVar);
    } else if (developmentOnlyVars.includes(name)) {
      development.push(envVar);
    } else {
      optional.push(envVar);
    }
  }

  return { required, optional, development };
}

/**
 * Validate environment variables
 */
export function validateEnv(): boolean {
  const envExamplePath = path.resolve(process.cwd(), ".env.example");

  console.log(`\n${colors.cyan}${colors.bright}● Environment Validation${colors.reset}\n`);

  // Parse .env.example
  let envVars: Map<string, string>;
  try {
    envVars = parseEnvExample(envExamplePath);
    console.log(`${colors.green}✓${colors.reset} Loaded .env.example with ${envVars.size} variables\n`);
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Failed to parse .env.example: ${error}\n`);
    return false;
  }

  // Categorize and validate
  const { required, optional, development } = categorizeEnvVars(envVars);

  // Check required variables
  const missingRequired = required.filter((v) => !v.value);

  if (missingRequired.length > 0) {
    console.log(`${colors.red}${colors.bright}Required Variables (Missing):${colors.reset}`);
    for (const v of missingRequired) {
      console.log(`  ${colors.red}✗${colors.reset} ${colors.bright}${v.name}${colors.reset}`);
      if (v.description) {
        console.log(`    ${colors.yellow}${v.description}${colors.reset}`);
      }
    }
    console.log("");
  }

  // Summary of required variables
  const presentRequired = required.filter((v) => v.value);
  if (presentRequired.length > 0) {
    console.log(`${colors.green}${colors.bright}Required Variables (Set):${colors.reset}`);
    for (const v of presentRequired) {
      const displayValue = v.value.length > 50 ? `${v.value.substring(0, 47)}...` : v.value;
      console.log(`  ${colors.green}✓${colors.reset} ${colors.bright}${v.name}${colors.reset} = ${colors.dim}${displayValue}${colors.reset}`);
    }
    console.log("");
  }

  // Optional variables status
  const presentOptional = optional.filter((v) => v.value);
  const missingOptional = optional.filter((v) => !v.value);

  if (presentOptional.length > 0) {
    console.log(`${colors.blue}${colors.bright}Optional Variables (Set):${colors.reset}`);
    for (const v of presentOptional) {
      console.log(`  ${colors.blue}●${colors.reset} ${v.name}`);
    }
    console.log("");
  }

  if (missingOptional.length > 0) {
    console.log(`${colors.yellow}${colors.bright}Optional Variables (Not Set):${colors.reset}`);
    for (const v of missingOptional.slice(0, 5)) {
      console.log(`  ${colors.yellow}○${colors.reset} ${v.name}`);
    }
    if (missingOptional.length > 5) {
      console.log(`  ${colors.yellow}○${colors.reset} ...and ${missingOptional.length - 5} more`);
    }
    console.log("");
  }

  // Development variables
  const presentDev = development.filter((v) => v.value);
  if (presentDev.length > 0) {
    console.log(`${colors.cyan}${colors.bright}Development Variables:${colors.reset}`);
    for (const v of presentDev) {
      console.log(`  ${colors.cyan}▸${colors.reset} ${v.name} = ${v.value}`);
    }
    console.log("");
  }

  // Final result
  if (missingRequired.length === 0) {
    console.log(`${colors.green}${colors.bright}✓ Validation passed!${colors.reset} All required environment variables are set.\n`);
    return true;
  } else {
    console.log(
      `${colors.red}${colors.bright}✗ Validation failed!${colors.reset} ${missingRequired.length} required variable(s) missing.\n`
    );
    console.log(`${colors.yellow}Please set the following before continuing:${colors.reset}`);
    for (const v of missingRequired) {
      console.log(`  ${colors.bright}${v.name}${colors.reset}${v.description ? ` — ${v.description}` : ""}`);
    }
    console.log("");
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  const success = validateEnv();
  process.exit(success ? 0 : 1);
}
