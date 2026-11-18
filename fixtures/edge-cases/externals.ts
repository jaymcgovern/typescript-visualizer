import type { Project as P } from "ts-morph";
import type { Project } from "ts-morph";

// Both properties reference the same external entity despite the alias.
export interface UsesExternal {
  aliased: P;
  direct: Project;
  map: Map<string, number>;
}

declare function mixin<T>(base: T): T;

// `mixin(Object)` is an expression, not a declaration; it must not become a placeholder node.
export class Mixed extends mixin(Object) {}
