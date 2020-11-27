// Note that Readonly < T > and Partial < T > are so useful, they are included
// in TypeScript’s standard library along with Pick and Record

// TS2.8 predefined conditional types
// Exclude < T, U > – Exclude from T those types that are assignable to U.
// Extract < T, U > – Extract from T those types that are assignable to U.
// NonNullable < T > – Exclude null and undefined from T.
// ReturnType < T > – Obtain the return type of a function type.
// InstanceType < T > – Obtain the instance type of a constructor function type.
// Note: The Exclude type is a proper implementation of the Diff type suggested
// here.We’ve used the name Exclude to avoid breaking existing code that defines
// a Diff, plus we feel that name better conveys the semantics of the type.We
// did not include the Omit < T, K > type because it is trivially written as
// Pick<T, Exclude<keyof T, K>>.

// self defined
type NonFunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? never : K
}[keyof T];
// export type NonFunctionProperties<T> = Pick<T, NonFunctionPropertyNames<T>>;
export type NonFunctionProperties<T> =
    Pick<T, Exclude<NonFunctionPropertyNames<T>, undefined>>;

// type RemainingPropertyNames<T, K extends keyof T> = {
//   [P in keyof T]: P extends K ? never : P;
// }[keyof T];
// export type Omit<T, K extends keyof T> = Pick<T, RemainingPropertyNames<T,
// K>>;
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
