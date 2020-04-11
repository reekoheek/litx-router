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
        <litx-router>
          <litx-route uri="/" view="${ce1}"></litx-route>
          <litx-route uri="/news" view="${ce2}"></litx-route>
        </litx-router>
      `);

      assert.strictEqual(router.started, true);

      try {
        await router.start();
        throw new Error('Must throw if already started');
      } catch (err) {
        if (err.message !== 'Must throw if already started') {
          // noop
        }
      }
    });

    it('change location href', async () => {
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
    });

    it('push with state', async () => {
      let data = '';
      const ceLocal = defineCE(class extends HTMLElement {
        connectedCallback () {
          data = this.ctx.state.middlewareAdded;
        }
      });

      const router = await fixture(html`
        <litx-router manual>
          <litx-route uri="/" view="${ce1}"></litx-route>
          <litx-route uri="/news" view="${ce2}"></litx-route>
          <litx-route uri="/news1" view="${ceLocal}"></litx-route>
        </litx-router>
      `);

      const logs = [];
      router.use(async (ctx, next) => {
        ctx.state.middlewareAdded = 'middleware put this';
        logs.push(ctx.state.foo);
        await next();
      });

      await router.start();
      await router.push('/news', { foo: 'bar' });
      assert.strictEqual(data, '');
      await router.push('/news1', { foo: 'bar1' });
      assert.strictEqual(data, 'middleware put this');
      await router.pop();

      assert.deepStrictEqual(logs, [undefined, 'bar', 'bar1', 'bar']);
    });

    it('parse parameter from uri', async () => {
      const logs = [];
      const ceLocal = defineCE(class extends HTMLElement {
        connectedCallback () {
          logs.push(this.ctx.parameters.bar);
        }
      });

      const router = await fixture(html`
        <litx-router manual>
          <litx-route uri="/" view="${ce1}"></litx-route>
          <litx-route uri="/foo/{bar}" view="${ceLocal}"></litx-route>
        </litx-router>
      `);

      await router.start();
      await router.push('/foo/1');
      await router.push('/foo/2');
      await router.replace('/foo/3');

      assert.deepStrictEqual(logs, ['1', '2', '3']);
    });

    it('parse query from uri', async () => {
      const logs = [];
      const ceLocal = defineCE(class extends HTMLElement {
        connectedCallback () {
          logs.push(this.ctx.query);
        }
      });

      const router = await fixture(html`
        <litx-router manual>
          <litx-route uri="/" view="${ce1}"></litx-route>
          <litx-route uri="/foo/{bar}" view="${ceLocal}"></litx-route>
        </litx-router>
      `);

      await router.start();
      await router.push('/foo/1?a=1');
      await router.push('/foo/1?b=2');

      assert.deepStrictEqual(logs, [{ a: '1' }, { b: '2' }]);
    });

    it('set loaders to lazy load views', async () => {
      const router = await fixture(html`
        <litx-router manual>
          <litx-route uri="/" view="test-home"></litx-route>
        </litx-router>
      `);

      let loaded = false;
      router.loaders = [
        {
          test () {
            return true;
          },

          load (view) {
            loaded = true;
            customElements.define('test-home', class extends HTMLElement {});
          },
        },
      ];

      assert.strictEqual(loaded, false);
      await router.start();
      assert.strictEqual(loaded, true);
    });

    it('use declarative middlewares', async () => {
      let hit = false;
      const mw1 = defineCE(class extends HTMLElement {
        callback () {
          return async (ctx, next) => {
            hit = true;
            await next();
          };
        }
      });

      await fixture(html`
        <litx-router>
          ${await fixture(`<${mw1} middleware></${mw1}>`)}

          <litx-route uri="/" view="${ce1}"></litx-route>
        </litx-router>
      `);

      assert.strictEqual(hit, true);
    });

    it('run mode history', async () => {
      const startingUrl = location.href;
      try {
        const view1 = defineCE(class extends HTMLElement {});

        const view2 = defineCE(class extends HTMLElement {});

        const router = await fixture(html`
          <litx-router mode="history">
            <litx-route uri="/context.html" view="${view1}"></litx-route>
            <litx-route uri="/debug.html" view="${view1}"></litx-route>
            <litx-route uri="/other.html" view="${view2}"></litx-route>
          </litx-router>
        `);

        await router.push('/other.html');
        assert.strictEqual(location.pathname, '/other.html');
      } finally {
        history.pushState(null, null, startingUrl);
      }
    });

    it('run with default route', async () => {
      let hit = false;
      const nf = defineCE(class extends HTMLElement {
        connectedCallback () {
          hit = true;
        }
      });

      const router = await fixture(html`
        <litx-router>
          <litx-route uri="/" view="${ce1}"></litx-route>
          <litx-route uri="*" view="${nf}"></litx-route>
        </litx-router>
      `);

      assert.strictEqual(hit, false);
      await router.push('/oops');
      assert.strictEqual(hit, true);
    });

    it('run with debug', async () => {
      const origInfo = console.info;
      try {
        const logs = [];
        console.info = log => logs.push(log);

        await fixture(html`
          <litx-router debug>
            <litx-route uri="/" view="${ce1}"></litx-route>
          </litx-router>
        `);

        assert.notStrictEqual(logs.length, 0);
      } finally {
        console.info = origInfo;
      }
    });
  });
});
