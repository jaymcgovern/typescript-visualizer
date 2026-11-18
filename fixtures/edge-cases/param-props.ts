import type { A, B } from "./merging";

export class P {
  constructor(
    private owner: A,
    plain: B,
  ) {
    void plain;
  }
}
