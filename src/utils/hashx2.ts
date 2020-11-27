import crypto from 'crypto';

export function hashx2(data: string|Buffer): Buffer {
  return crypto.createHash('sha256')
      .update(crypto.createHash('sha256').update(data).digest())
      .digest();
}
