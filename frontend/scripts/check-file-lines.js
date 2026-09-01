import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');
const MAX_LINES = 500;

const EXTENSIONS = new Set(['.svelte', '.ts', '.js', '.css']);

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (EXTENSIONS.has(path.extname(filePath))) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = getAllFiles(srcDir);
const violations = [];

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const lineCount = content.split('\n').length;
  if (lineCount > MAX_LINES) {
    const relPath = path.relative(path.resolve(__dirname, '../..'), file);
    violations.push({ path: relPath, lines: lineCount });
  }
}

if (violations.length > 0) {
  console.error('\x1b[31m%s\x1b[0m', `\n❌ 代码行数校验失败！以下 ${violations.length} 个文件超过了 ${MAX_LINES} 行限制：\n`);
  for (const v of violations) {
    console.error(`  - \x1b[33m${v.path}\x1b[0m: \x1b[31m${v.lines}\x1b[0m 行 (超出 ${v.lines - MAX_LINES} 行)`);
  }
  console.error('\x1b[36m%s\x1b[0m', `\n💡 提示：请合理拆分组件/逻辑，保持单文件轻量简洁 (<= ${MAX_LINES} 行)！\n`);
  process.exit(1);
} else {
  console.log('\x1b[32m%s\x1b[0m', `✅ 前端代码行数校验通过：所有文件均严格控制在 ${MAX_LINES} 行以内 (共检查 ${allFiles.length} 个文件)。`);
  process.exit(0);
}
