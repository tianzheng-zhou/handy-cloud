// Drafts GitHub Release notes for a tag from conventional commits since the
// previous tag. Usage: bun scripts/release-notes.ts v0.2.0 > notes.md
import { execFileSync } from "node:child_process";

const tag = process.argv[2];
if (!tag) {
  console.error("Usage: bun scripts/release-notes.ts <tag>");
  process.exit(1);
}

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

let previous = "";
try {
  previous = git(
    "describe",
    "--tags",
    "--abbrev=0",
    "--match",
    "v*",
    `${tag}^`,
  );
} catch {
  // First release: there is no earlier tag to diff against.
}

const sections: [string, string, RegExp][] = [
  ["feat", "新功能", /^feat(\(.+\))?!?:/],
  ["fix", "修复", /^fix(\(.+\))?!?:/],
  ["perf", "性能", /^perf(\(.+\))?!?:/],
  ["refactor", "重构", /^refactor(\(.+\))?!?:/],
];

const lines: string[] = [
  "## 平台支持",
  "",
  "| 平台 | 状态 |",
  "| --- | --- |",
  "| Linux x64（AppImage / deb / rpm） | 已实机验证 |",
  "| Windows x64（NSIS / MSI） | 实验性：CI 测试与安装冒烟通过，未经实机验证 |",
  "| macOS（Apple Silicon / Intel） | 实验性：CI 测试通过，未经实机验证 |",
  "",
  "安装包未做代码签名。Windows 若出现 SmartScreen，选择“更多信息 → 仍要运行”；",
  'macOS 若提示已损坏，执行 `xattr -cr "/Applications/Handy Cloud.app"`。',
  "Windows / macOS 上遇到问题欢迎[提交 issue](https://github.com/tianzheng-zhou/handy-cloud/issues/new/choose)。",
  "",
];

if (!previous) {
  lines.push("## 变更", "", "Handy Cloud 的首个独立版本，功能说明见 README。");
} else {
  const subjects = git(
    "log",
    "--no-merges",
    "--format=%s",
    `${previous}..${tag}`,
  )
    .split("\n")
    .filter(Boolean);
  const used = new Set<string>();
  for (const [, title, pattern] of sections) {
    const items = subjects.filter((s) => pattern.test(s));
    if (!items.length) continue;
    items.forEach((s) => used.add(s));
    lines.push(`## ${title}`, "", ...items.map((s) => `- ${s}`), "");
  }
  const rest = subjects.filter(
    (s) =>
      !used.has(s) && !/^(docs|chore|ci|style|test|build)(\(.+\))?:/.test(s),
  );
  if (rest.length) lines.push("## 其他", "", ...rest.map((s) => `- ${s}`), "");
  lines.push(
    `**完整变更**：https://github.com/tianzheng-zhou/handy-cloud/compare/${previous}...${tag}`,
  );
}

console.log(lines.join("\n"));
