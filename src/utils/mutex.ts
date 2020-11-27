export type resolver<T> = (value?: T|PromiseLike<T>) => void;

export class Mutex {
  private _locked: boolean;
  private _unlockers: Array<resolver<void>>;

  constructor() {
    this._locked = false;
    this._unlockers = [];
  }

  acquire(): Promise<void> {
    if (!this._locked) {
      this._locked = true;
      return Promise.resolve();
    } else
      return new Promise<void>(resolve => {
        this._unlockers.push(resolve);
      });
  }

  release(): void {
    if (this._unlockers.length === 0)
      this._locked = false;
    else {
      const unlocker = this._unlockers.shift();
      unlocker!();
    }
  }

  private async run<T, U1>(
      callbackFn: (arg: U1) => Promise<T>| T, arg?: [U1],
      thisArg?: any): Promise<T>;
  private async run<T, U1, U2>(
      callbackFn: (arg1: U1, arg2: U2) => Promise<T>| T, arg?: [U1, U2],
      thisArg?: any): Promise<T>;
  private async run<T, U1, U2, U3>(
      callbackFn: (arg1: U1, arg2: U2, arg3: U3) => Promise<T>| T,
      arg?: [U1, U2, U3], thisArg?: any): Promise<T>;  // add more as needed
  private async run<T>(
      callbackFn: (...args: any[]) => Promise<T>| T, thisArg?: any): Promise<T>;
  private async run<T>(
      callbackFn: (...args: any[]) => Promise<T>| T, x?: any,
      thisArg?: any): Promise<T> {
    await this.acquire();
    let result: T;
    try {
      if (x instanceof Array)
        result = await callbackFn.apply(thisArg, x);
      else
        result = await callbackFn.apply(x);
    } finally {
      this.release();
    }
    return result;
  }

  static create(): Mutex['run'] {
    const mutex = new this();
    return mutex.run.bind(mutex);
  }
}
