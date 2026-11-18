export interface Circle {
  kind: "circle";
  radius: number;
}

export interface Square {
  kind: "square";
  side: number;
}

export type Color = string;

export type Shape = Circle | Square;

export type Drawable = Shape & { color: Color };
