export interface Named {
  name: string;
}

/**
 * A person who can own pets.
 *
 * This second paragraph is not part of `doc`.
 */
export class Person implements Named {
  name = "";
  pets: Pet[] = [];
}

/** A pet that can be adopted. */
export interface Pet extends Named {
  owner?: Person;
}

/** Looks a pet up by name. */
export function lookup(name: string): Pet;
export function lookup(name: string, owner: Person): Pet;
export function lookup(name: string, owner?: Person): Pet {
  return { name, owner };
}

/** The default pet. */
export const defaultPet: Pet = { name: "rex" };
