import type { A, B } from "./merging";

export interface Dict {
  [k: string]: A;
  (q: B): A;
  new (q: B): Dict;
}
