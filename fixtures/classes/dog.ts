import { Base } from "./base";
import type { Animal, Walkable } from "./animal";
import type { Owner } from "./owner";

export class Dog extends Base implements Animal, Walkable {
  name = "rex";
  owner?: Owner;

  speak(): string {
    return "woof";
  }

  walk(distance: number): void {
    void distance;
  }

  adopt(pet: Animal): Dog {
    void pet;
    return this;
  }
}
