import type { A, B } from "./merging";

export function f(a: A): A;
export function f(b: B): B;
export function f(x: unknown): unknown {
  return x;
}

export class Svc {
  run(a: A): A;
  run(b: B): B;
  run(x: unknown): unknown {
    return x;
  }
}
