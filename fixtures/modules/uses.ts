import type { B } from "./reexport";
import type { NS } from "./a";

// `B` is a re-export alias of `A` in ./a; edges must point at A, not at reexport.ts.
export interface UsesB {
  b: B;
  inner: NS.Inner;
}
