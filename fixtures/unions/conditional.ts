import type { Circle, Square } from "./shapes";

export type Cond<T> = T extends Circle ? Square : never;
