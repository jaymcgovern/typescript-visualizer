export interface Animal {
  name: string;
  speak(): string;
}

export interface Walkable {
  walk(distance: number): void;
}
