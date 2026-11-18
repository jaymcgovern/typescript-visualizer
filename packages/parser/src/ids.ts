import path from "node:path";

/** Root-relative, forward-slash file path. */
export function relativePath(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join("/");
}

export function makeId(file: string, qualifiedName: string): string {
  return `${file}#${qualifiedName}`;
}
