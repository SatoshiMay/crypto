import {BufReader} from '../../src/utils/buf-read-write';


describe('BufReader', () => {
  test('read32UInt = 0', () => {
    const buf = Buffer.alloc(4, 0);
    const br = new BufReader(buf);
    expect(br.read32UInt()).toEqual(0);
  });

  test('read32UInt = 0xffffffff', () => {
    const buf = Buffer.alloc(4, 255);
    const br = new BufReader(buf);
    expect(br.read32UInt()).toEqual(2 ** 32 - 1);
  });

  test('read32UInt = 0x0000fffe', () => {
    const buf = Buffer.from([0x00, 0x00, 0xff, 0xfe]);
    const br = new BufReader(buf);
    expect(br.read32UInt()).toEqual(0xfeff0000);
  });
});
