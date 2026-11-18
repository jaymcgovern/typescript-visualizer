export interface A {
  a: number;
}

export interface B {
  b: number;
}

// Interface + class declaration merging: one entity, kind "class", members from both.
export interface Foo {
  extra: A;
}
export class Foo {
  base?: B;
}

// Value + type sharing a name: two distinct entities.
export const Status = { On: "on", Off: "off" } as const;
export type Status = (typeof Status)[keyof typeof Status];
