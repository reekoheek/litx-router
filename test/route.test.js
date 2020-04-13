import { Route } from '../route';
import { assert, fixture } from '@open-wc/testing';
import { Context } from '../context';
import { html } from 'lit-html';

describe('Route', () => {
  describe('#enter()', () => {
    it('set props to view element', async () => {
      const mock = await fixture(html`
        <div>
          <div id="marker"></div>
        </div>
      `);
      const props = { foo: 'bar' };
      const route = new Route({ uri: '/', view: 'some-view', props, marker: mock.querySelector('#marker') });
      await route.enter(new Context({ uri: '/' }));
      assert.strictEqual(route.viewElement.foo, 'bar');
    });
  });
});
