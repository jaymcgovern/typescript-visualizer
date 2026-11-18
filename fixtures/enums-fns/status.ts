export enum Status {
  Active = "active",
  Inactive = "inactive",
}

export interface Account {
  status: Status;
}

export const defaultStatus: Status = Status.Active;

export type DefaultStatusType = typeof defaultStatus;

export function describe(s: Status): string {
  return String(s);
}
