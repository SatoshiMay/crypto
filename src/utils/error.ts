export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function assertNever(value: never, message: string): never {
  throw new Error(`Assert never value: '${value}'\n${message}`);
}
