import { promises as fs } from "fs";
import path from "path";

import { I18N_NAMESPACES, SUPPORTED_LANGUAGES } from "../src/lib/i18n-config";

type KeyLocation = {
  key: string;
  file: string;
  line: number;
};

const SOURCE_ROOT = path.join(process.cwd(), "src");
const LOCALES_ROOT = path.join(process.cwd(), "locales");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

async function walkFiles(targetPath: string): Promise<string[]> {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }
    if (entry.name.endsWith(".d.ts")) {
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function getLineNumber(source: string, index: number) {
  return source.slice(0, index).split("\n").length;
}

function extractUsedTranslationKeys(filePath: string, source: string) {
  const results: KeyLocation[] = [];
  const regex = /\b(?:t|translate)\(\s*["'`]([a-z0-9_]+)["'`]\s*\)/g;
  let match: RegExpExecArray | null = regex.exec(source);
  while (match) {
    results.push({
      key: match[1],
      file: path.relative(process.cwd(), filePath),
      line: getLineNumber(source, match.index),
    });
    match = regex.exec(source);
  }
  return results;
}

async function loadLocaleKeys(language: (typeof SUPPORTED_LANGUAGES)[number], namespace: string) {
  const localeFilePath = path.join(LOCALES_ROOT, language, `${namespace}.json`);
  const content = await fs.readFile(localeFilePath, "utf-8");
  const parsed = JSON.parse(content) as Record<string, unknown>;
  return new Set(
    Object.entries(parsed)
      .filter(([, value]) => typeof value === "string")
      .map(([key]) => key),
  );
}

function printTitle(text: string) {
  process.stdout.write(`\n[check:i18n] ${text}\n`);
}

async function main() {
  const enNamespaceKeys = new Map<string, Set<string>>();
  const allEnKeys = new Set<string>();

  for (const namespace of I18N_NAMESPACES) {
    const keys = await loadLocaleKeys("en", namespace);
    enNamespaceKeys.set(namespace, keys);
    for (const key of keys) {
      allEnKeys.add(key);
    }
  }

  const missingByLanguage: Array<{
    language: string;
    namespace: string;
    keys: string[];
  }> = [];

  for (const language of SUPPORTED_LANGUAGES) {
    if (language === "en") {
      continue;
    }

    for (const namespace of I18N_NAMESPACES) {
      const baseKeys = enNamespaceKeys.get(namespace) ?? new Set<string>();
      const targetKeys = await loadLocaleKeys(language, namespace);
      const missingKeys = [...baseKeys].filter((key) => !targetKeys.has(key)).sort();
      if (missingKeys.length > 0) {
        missingByLanguage.push({
          language,
          namespace,
          keys: missingKeys,
        });
      }
    }
  }

  const sourceFiles = await walkFiles(SOURCE_ROOT);
  const usedLocations: KeyLocation[] = [];

  for (const sourceFile of sourceFiles) {
    const source = await fs.readFile(sourceFile, "utf-8");
    usedLocations.push(...extractUsedTranslationKeys(sourceFile, source));
  }

  const missingUsedKeys = usedLocations.filter((location) => !allEnKeys.has(location.key));
  const groupedMissingUsedKeys = new Map<string, KeyLocation[]>();
  for (const location of missingUsedKeys) {
    const rows = groupedMissingUsedKeys.get(location.key) ?? [];
    rows.push(location);
    groupedMissingUsedKeys.set(location.key, rows);
  }

  if (missingByLanguage.length === 0 && groupedMissingUsedKeys.size === 0) {
    printTitle("모든 i18n 정적 검사를 통과했습니다.");
    return;
  }

  if (groupedMissingUsedKeys.size > 0) {
    printTitle("코드에서 사용하지만 영어 번역(en)에 없는 키가 있습니다.");
    for (const [key, locations] of groupedMissingUsedKeys.entries()) {
      process.stdout.write(`- ${key}\n`);
      for (const location of locations) {
        process.stdout.write(`  - ${location.file}:${location.line}\n`);
      }
    }
  }

  if (missingByLanguage.length > 0) {
    printTitle("영어(en) 대비 언어별 누락 키가 있습니다.");
    for (const row of missingByLanguage) {
      process.stdout.write(`- ${row.language}/${row.namespace}: ${row.keys.join(", ")}\n`);
    }
  }

  process.stderr.write("\n[check:i18n] 실패: 번역 누락을 수정한 뒤 다시 실행하세요.\n");
  process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`[check:i18n] 실행 오류: ${String(error)}\n`);
  process.exit(1);
});
