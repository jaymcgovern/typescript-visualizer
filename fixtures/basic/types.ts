export interface Address {
  street: string;
  city: string;
}

export interface Named {
  name: string;
}

export interface User extends Named {
  id: number;
  address: Address;
  manager?: User;
}

export type UserId = number;

export type Maybe = User | null;

export interface Registry {
  users: Map<string, User>;
}
