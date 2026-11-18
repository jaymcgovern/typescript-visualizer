export interface Keyed {
  key: string;
}

export interface Box<T> {
  value: T;
}

export interface Pair<A, B extends Keyed = Keyed> {
  first: A;
  second: B;
}

export interface Repo<T> {
  items: Box<T>[];
  find(id: string): Box<T> | undefined;
}

export function unwrap<T extends Keyed>(b: Box<T>): T {
  return b.value;
}
