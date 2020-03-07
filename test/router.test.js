import { fixture, html, defineCE, assert } from '@open-wc/testing';

import '..';

const ce1 = defineCE(class extends HTMLElement {
  connectedCallback () {
    this.innerHTML = '1';
  }
});

const ce2 = defineCE(class extends HTMLElement {
  connectedCallback () {
    this.innerHTML = '2';
  }
});

describe('Router', () => {
  beforeEach(() => {
    location.hash = '#';
  });

  afterEach(() => {
    location.hash = '#';
  });

  describe('cases', () => {
    it('run router', async () => {
      const router = await fixture(html`
        <litx-router manual>
          <litx-route uri="/" view="${ce1}"></litx-route>
          <litx-route uri="/news" view="${ce2}"></litx-route>
        </litx-router>
      `);

      assert.strictEqual(router.getUri(router.location), '/');
      await router.start();
      assert.strictEqual(router.getUri(router.location), '/');
      await router.push('/news');
      assert.strictEqual(router.getUri(router.location), '/news');
      await router.pop();
      assert.strictEqual(router.getUri(router.location), '/');
    });

    it('run middleware', async () => {
      const router = await fixture(html`
        <litx-router manual>
          <litx-route uri="/" view="${ce1}"></litx-route>
          <litx-route uri="/news" view="${ce2}"></litx-route>
        </litx-router>
      `);

      const logs = [];
      router.use(async (ctx, next) => {
        logs.push('1 before');
        await next();
        logs.push('1 after');
      });

      router.use(async (ctx, next) => {
        logs.push('2 before');
        await next();
        logs.push('2 after');
      });

      await router.start();

      assert.deepEqual(logs, ['1 before', '2 before', '2 after', '1 after']);
      // assert.strictEqual(router.getUri(router.location), '/');
      // assert.strictEqual(router.getUri(router.location), '/');
      // await router.push('/news');
      // assert.strictEqual(router.getUri(router.location), '/news');
      // await router.pop();
      // assert.strictEqual(router.getUri(router.location), '/');
    });
  });
});
