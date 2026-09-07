const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = process.cwd();
const ignoreDirs = ["node_modules", ".git"];

function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!ignoreDirs.includes(item)) {
        results = results.concat(getAllJsFiles(fullPath));
      }
    } else if (item.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}

const jsFiles = getAllJsFiles(rootDir);
let hasError = false;

for (const file of jsFiles) {
  try {
    execSync(`node --check "${file}"`, { stdio: "pipe" });
    console.log(`✅ OK: ${path.relative(rootDir, file)}`);
  } catch (err) {
    hasError = true;
    console.error(`❌ SYNTAX ERROR: ${path.relative(rootDir, file)}`);
    console.error(err.stderr ? err.stderr.toString() : err.message);
  }
}

if (hasError) {
  console.log("\n⚠️ Some files have syntax errors. Fix them and re-run.");
} else {
  console.log("\n🎉 All JavaScript files passed syntax check.");
}
