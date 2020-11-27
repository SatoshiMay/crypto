import debug, {IDebugger} from 'debug';

export class Logger {
  e: IDebugger;
  i: IDebugger;
  v: IDebugger;
  d: IDebugger;
  a: IDebugger;

  constructor(module: string) {
    this.e = debug(module + ':error');
    this.i = debug(module + ':info');
    this.v = debug(module + ':verbose');
    this.d = debug(module + ':debug');
    // a: debug(module + ":always") // always
    this.a = debug(module + ':*');  // always
  }
}

export function tree(x: any) {
  return JSON.stringify(x, null, 4);
}
