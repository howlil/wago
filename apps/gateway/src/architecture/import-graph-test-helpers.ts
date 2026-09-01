import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export function typescriptFiles(directory: string, options: { includeTests?: boolean } = {}): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return typescriptFiles(path, options);
    }

    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      return [];
    }

    if (options.includeTests === false && entry.name.endsWith(".test.ts")) {
      return [];
    }

    return [path];
  });
}

export function moduleSpecifiers(source: string): string[] {
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    /\bvi\.mock\(\s*["']([^"']+)["']/g,
  ];

  return patterns.flatMap((pattern) => Array.from(source.matchAll(pattern), (match) => match[1] ?? ""));
}

export function importedSpecifiers(file: string): string[] {
  return moduleSpecifiers(readFileSync(file, "utf8"));
}

export function resolvesUnder(file: string, specifier: string, directory: string): boolean {
  if (!specifier.startsWith(".")) {
    return false;
  }

  const target = resolve(dirname(file), specifier.replace(/\.js$/, ""));
  return target === directory || target.startsWith(`${directory}/`);
}

export function relativePath(root: string, file: string): string {
  return relative(root, file).replaceAll("\\", "/");
}
