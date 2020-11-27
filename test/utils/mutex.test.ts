import {Mutex} from '../../src/utils/mutex';


describe('Mutex', () => {
  test('Synchronous function with param w/o mutex', () => {
    const syncFn = (i: number) => {
      return i;
    };
    const res1 = syncFn(1);
    const res2 = syncFn(5);
    expect(res1).toEqual(1);
    expect(res2).toEqual(5);
  });

  test('Synchronous function with param with mutex', async () => {
    expect.assertions(2);
    const mutex = Mutex.create();
    const syncFn = (i: number) => {
      return i;
    };
    const promise1 = mutex(syncFn, [1]).then(val => {
      expect(val).toEqual(1);
    });
    const promise2 = mutex(syncFn, [4]).then(val => {
      expect(val).toEqual(4);
    });
    await Promise.all([promise1, promise2]);
  });

  test('Synchronous function with param, thisArg and mutex', async () => {
    expect.assertions(4);
    const mutex = Mutex.create();
    const thisArg = {dummy: true};
    const syncFn = function(i: number) {
      // @ts-ignore
      expect(this).toBe(thisArg);
      return i;
    };
    const promise1 = mutex(syncFn, [1], thisArg).then(val => {
      expect(val).toEqual(1);
    });
    const promise2 = mutex(syncFn, [4], thisArg).then(val => {
      expect(val).toEqual(4);
    });
    await Promise.all([promise1, promise2]);
  });

  test(
      'Synchronous function without param, thisArg and with mutex',
      async () => {
        expect.assertions(2);
        const mutex = Mutex.create();
        const i = 1;
        const syncFn = () => {
          return i;
        };
        const promise1 = mutex(syncFn).then(val => {
          expect(val).toEqual(1);
        });
        const promise2 = mutex(syncFn).then(val => {
          expect(val).toEqual(1);
        });
        await Promise.all([promise1, promise2]);
      });

  test(
      'Synchronous function without param with thisArg and mutex', async () => {
        expect.assertions(4);
        const mutex = Mutex.create();
        const i = 1;
        const thisArg = {dummy: true};
        const syncFn = function() {
          // @ts-ignore
          expect(this).toBe(thisArg);
          return i;
        };
        const promise1 = mutex(syncFn, thisArg).then(val => {
          expect(val).toEqual(1);
        });
        const promise2 = mutex(syncFn, thisArg).then(val => {
          expect(val).toEqual(1);
        });
        await Promise.all([promise1, promise2]);
      });

  test('Asynchronous function with param w/o mutex', async () => {
    expect.assertions(2);
    let i = 0;
    const asyncFn = async () => {
      i++;
      return new Promise((resolve, reject) => setTimeout(() => {
                           resolve(i);
                         }, 0));
    };
    const promise1 = asyncFn().then(val => expect(val).toEqual(2));
    const promise2 = asyncFn().then(val => expect(val).toEqual(2));
    await Promise.all([promise1, promise2]);
  });

  test('Asynchronous function with param with mutex', async () => {
    expect.assertions(2);
    const mutex = Mutex.create();
    let i = 0;
    const asyncFn = async () => {
      i++;
      return new Promise((resolve, reject) => setTimeout(() => {
                           resolve(i);
                         }, 0));
    };
    const promise1 = mutex(asyncFn).then(val => expect(val).toEqual(1));
    const promise2 = mutex(asyncFn).then(val => expect(val).toEqual(2));
    await Promise.all([promise1, promise2]);
  });

  test('Asynchronous function II with param without mutex', async () => {
    expect.assertions(2);
    const mutex = Mutex.create();
    let i = 0;
    const asyncFn = async () => {
      return new Promise((resolve, reject) => setTimeout(() => {
                           i++;
                           resolve(i);
                         }, 0));
    };
    const promise1 = asyncFn().then(val => expect(val).toEqual(1));
    const promise2 = asyncFn().then(val => expect(val).toEqual(2));
    await Promise.all([promise1, promise2]);
  });
  test('Asynchronous function II with param with mutex', async () => {
    expect.assertions(2);
    const mutex = Mutex.create();
    let i = 0;
    const asyncFn = async () => {
      return new Promise((resolve, reject) => setTimeout(() => {
                           i++;
                           resolve(i);
                         }, 0));
    };
    const promise1 = mutex(asyncFn).then(val => expect(val).toEqual(1));
    const promise2 = mutex(asyncFn).then(val => expect(val).toEqual(2));
    await Promise.all([promise1, promise2]);
  });
  test('Asynchronous function III with param without mutex', async () => {
    expect.assertions(2);
    const mutex = Mutex.create();
    let i = 0;
    const asyncFn = async () => {
      return new Promise((resolve, reject) => {
        i++;
        setTimeout(() => resolve(i), 0);
      });
    };
    const promise1 = asyncFn().then(val => expect(val).toEqual(2));
    const promise2 = asyncFn().then(val => expect(val).toEqual(2));
    await Promise.all([promise1, promise2]);
  });
  test('Asynchronous function III with param with mutex', async () => {
    expect.assertions(2);
    const mutex = Mutex.create();
    let i = 0;
    const asyncFn = async () => {
      return new Promise((resolve, reject) => {
        i++;
        setTimeout(() => resolve(i), 0);
      });
    };
    const promise1 = mutex(asyncFn).then(val => expect(val).toEqual(1));
    const promise2 = mutex(asyncFn).then(val => expect(val).toEqual(2));
    await Promise.all([promise1, promise2]);
  });
  test('Asynchronous function IV with param without mutex', async () => {
    expect.assertions(2);
    const mutex = Mutex.create();
    let i = 0;
    const asyncFn = async () => {
      return new Promise((resolve, reject) => {
        i++;
        resolve(i);
      });
    };
    const promise1 = asyncFn().then(val => expect(val).toEqual(1));
    const promise2 = asyncFn().then(val => expect(val).toEqual(2));
    await Promise.all([promise1, promise2]);
  });
  test('Asynchronous function IV with param with mutex', async () => {
    expect.assertions(2);
    const mutex = Mutex.create();
    let i = 0;
    const asyncFn = async () => {
      return new Promise((resolve, reject) => {
        i++;
        resolve(i);
      });
    };
    const promise1 = mutex(asyncFn).then(val => expect(val).toEqual(1));
    const promise2 = mutex(asyncFn).then(val => expect(val).toEqual(2));
    await Promise.all([promise1, promise2]);
  });

  test('Nested async functions without mutex', async () => {
    expect.assertions(2);
    const mutex = Mutex.create();
    let i = 0;
    const async1Fn = async () => {
      i++;
      return new Promise((resolve, reject) => setTimeout(() => {
                           resolve();
                         }, 0));
    };
    const async2Fn = async () => {
      await async1Fn();
      i++;
      return i;
    };
    const promise1 = async2Fn().then(val => expect(val).toEqual(3));
    const promise2 = async2Fn().then(val => expect(val).toEqual(4));
    await Promise.all([promise1, promise2]);
  });

  test('Nested asynch functions with mutex', async () => {
    expect.assertions(2);
    const mutex = Mutex.create();
    let i = 0;
    const async1Fn = async () => {
      i++;
      return new Promise((resolve, reject) => setTimeout(() => {
                           resolve();
                         }, 0));
    };
    const async2Fn = async () => {
      await mutex(async1Fn);
      i++;
      return i;
    };
    const promise1 = async2Fn().then(val => expect(val).toEqual(3));
    const promise2 = async2Fn().then(val => expect(val).toEqual(4));
    await Promise.all([promise1, promise2]);
  });
});
