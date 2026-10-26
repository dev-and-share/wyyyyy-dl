import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');

const EXTENSIONS = new Set(['.svelte', '.ts']);
const CHINESE_REGEX = /[\u4e00-\u9fa5]/;

function isIgnored(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  if (norm.includes('/lib/i18n/locales/')) return true;
  if (norm.endsWith('.test.ts') || norm.endsWith('.spec.ts')) return true;
  if (norm.endsWith('/test-setup.ts')) return true;
  return false;
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      getAllFiles(full, fileList);
    } else if (EXTENSIONS.has(path.extname(full))) {
      fileList.push(full);
    }
  }
  return fileList;
}

function cleanLineForScan(line) {
  const trimmed = line.trim();
  // Strip single-line comments
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('<!--')) {
    return '';
  }
  // Allow ignoring lines with // i18n-ignore or /* i18n-ignore */
  if (line.includes('i18n-ignore')) {
    return '';
  }
  return line;
}

export function scanChinese(rootDir = srcDir) {
  const allFiles = getAllFiles(rootDir).filter(f => !isIgnored(f));
  const results = [];

  for (const file of allFiles) {
    const relPath = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const fileMatches = [];

    lines.forEach((line, idx) => {
      const cleaned = cleanLineForScan(line);
      if (CHINESE_REGEX.test(cleaned)) {
        fileMatches.push({
          line: idx + 1,
          text: line.trim()
        });
      }
    });

    if (fileMatches.length > 0) {
      results.push({
        file: relPath,
        matches: fileMatches
      });
    }
  }

  return results;
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('i18n-scan.js')) {
  const strict = process.argv.includes('--strict');
  const json = process.argv.includes('--json');
  const results = scanChinese();

  const totalFiles = results.length;
  const totalOccurrences = results.reduce((acc, r) => acc + r.matches.length, 0);

  if (json) {
    console.log(JSON.stringify({ totalFiles, totalOccurrences, results }, null, 2));
  } else {
    console.log(`\n🔍 i18n 扫描结果：共发现 ${totalFiles} 个文件，${totalOccurrences} 处硬编码中文\n`);
    results.forEach(r => {
      console.log(`📄 ${r.file} (${r.matches.length} 处)`);
      if (!process.argv.includes('--summary')) {
        r.matches.slice(0, 5).forEach(m => {
          console.log(`   L${m.line}: ${m.text.slice(0, 80)}`);
        });
        if (r.matches.length > 5) {
          console.log(`   ... 还有 ${r.matches.length - 5} 处`);
        }
      }
    });
  }

  if (strict && totalOccurrences > 0) {
    console.error(`\n❌ i18n 严格模式检查失败：存在残留硬编码中文。`);
    process.exit(1);
  }
}
