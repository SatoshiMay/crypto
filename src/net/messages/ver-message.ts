export class VerMessage {
  constructor(private readonly _type: 'version' = 'version') {}

  get type(): 'version' {
    return this._type;
  }

  serialize(): Buffer {
    return Buffer.alloc(0);
  }

  static deserialize(): VerMessage {
    return new this();
  }
}
