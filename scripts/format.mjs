import { execFileSync } from "node:child_process";
import { lstat, readFile, writeFile } from "node:fs/promises";
import * as prettier from "prettier";

const [mode, ...targets] = process.argv.slice(2);
if (!["--write", "--check"].includes(mode)) {
  throw new Error("--write 또는 --check를 지정해 주세요.");
}
const all = targets.includes("--all");
if (all && (mode === "--write" || targets.length !== 1)) {
  throw new Error("--all은 --check와만, 파일 경로 없이 사용해 주세요.");
}
if (targets.some((target) => target.startsWith("--") && target !== "--all")) {
  throw new Error("지원하지 않는 옵션이에요.");
}

const gitFiles = (...args) =>
  execFileSync("git", args, { encoding: "utf8" }).split("\0").filter(Boolean);
const files = all
  ? gitFiles("ls-files", "--cached", "--others", "--exclude-standard", "-z")
  : targets.length
    ? targets
    : [
        ...gitFiles("diff", "HEAD", "--name-only", "--diff-filter=ACMR", "-z"),
        ...gitFiles("ls-files", "--others", "--exclude-standard", "-z"),
      ];
let failed = false;
let checked = 0;

for (const file of new Set(files)) {
  // 링크를 따라가 외부 파일을 쓰거나 디렉터리를 읽지 않아요.
  const stat = await lstat(file).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!stat?.isFile()) continue;
  const info = await prettier.getFileInfo(file, {
    ignorePath: ".prettierignore",
  });
  if (info.ignored || !info.inferredParser) continue;

  checked += 1;
  const options = { ...(await prettier.resolveConfig(file)), filepath: file };
  const input = await readFile(file, "utf8");
  if (mode === "--write") {
    const output = await prettier.format(input, options);
    if (output !== input) await writeFile(file, output);
  } else if (!(await prettier.check(input, options))) {
    console.error(`포매팅 필요: ${file}`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;
else {
  const result = mode === "--write" ? "완료" : "확인 통과";
  console.info(`${checked}개 파일 포매팅 ${result}`);
}
