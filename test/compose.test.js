import { compose } from '../compose';
import { assert } from '@open-wc/testing';

describe('compose()', () => {
  it('accept array of functions', () => {
    compose([
      () => undefined,
      () => undefined,
    ]);

    assert.throws(() => {
      compose([
        'hello',
      ]);
    });
  });
});
