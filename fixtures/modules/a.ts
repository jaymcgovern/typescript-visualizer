export interface A {
  x: number;
}

export type Internal = string;

export namespace NS {
  export interface Inner {
    a: A;
  }
}
