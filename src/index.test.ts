import { assert, fixture } from '@open-wc/testing';
import { html } from 'lit';
import {
  debug,
  inspect,
  configure,
  reset,
  push,
  replace,
  pop,
  go,
  Outlet,
  Middlewares,
  Routes,
  Router,
  router,
} from './index';

describe('litx-router', () => {
  beforeEach(() => {
    debug(true);
    reset();
    history.replaceState(null, '', '#');
  });

  afterEach(() => {
    debug(false);
    reset();
  });

  describe('reset()', () => {
    it('remove state', () => {
      configure();
      reset();
      assert.strictEqual(inspect(), undefined);
    });
  });

  describe('configure()', () => {
    it('initialize state', () => {
      configure();
      assert.notStrictEqual(inspect(), undefined);
    });

    it('extend config', () => {
      configure();
      assert.strictEqual(inspect()?.config.mode, 'history');
      configure({ mode: 'hash' });
      assert.strictEqual(inspect()?.config.mode, 'hash');
    });

    it('listening popstate event', () => {
      let hit = 0;
      debug({ popStateEventListener: () => (hit++) });
      window.dispatchEvent(new PopStateEvent('popstate'));
      assert.strictEqual(hit, 0);
      configure();
      window.dispatchEvent(new PopStateEvent('popstate'));
      assert.strictEqual(hit, 1);
    });

    it('listening click event', () => {
      let hit = 0;
      debug({ clickEventListener: () => (hit++) });
      window.dispatchEvent(new CustomEvent('click'));
      assert.strictEqual(hit, 0);
      configure();
      window.dispatchEvent(new CustomEvent('click'));
      assert.strictEqual(hit, 1);
    });

    it('listening router-dispatch event', () => {
      let hit = 0;
      debug({ routerDispatchEventListener: () => (hit++) });
      window.dispatchEvent(new CustomEvent('router-dispatch'));
      assert.strictEqual(hit, 0);
      configure();
      window.dispatchEvent(new CustomEvent('router-dispatch'));
      assert.strictEqual(hit, 1);
    });
  });

  describe('inspect()', () => {
    it('inspect state', () => {
      assert.strictEqual(inspect(), undefined);
      configure();
      assert.notStrictEqual(inspect(), undefined);
    });
  });

  describe('event: click', () => {
    it('push to location and dispatch', async () => {
      history.replaceState(null, '', '#!/1');
      history.pushState(null, '', '#!/2');
      debug({
        routerDispatchEventListener: () => undefined,
      });
      configure({ mode: 'hash' });
      const el = await fixture(html`<a href="#!/foo">click</a>`);
      const dispatched = waitFor(window, 'router-dispatch');
      el.dispatchEvent(new CustomEvent('click', { bubbles: true }));
      await dispatched;
      assert.strictEqual(location.hash, '#!/foo');
      const navigated = waitFor(window, 'popstate');
      history.back();
      await navigated;
      assert.strictEqual(location.hash, '#!/2');
      history.replaceState(null, '', '#');
    });
  });

  describe('event: router-dispatch', () => {
    it('dispatch to all registered dispatchers', () => {
      const logs: number[] = [];
      const createDispatcher = (index: number) => ({
        dispatch () {
          logs.push(index);
          return Promise.resolve(true);
        },
      });
      configure();
      const state = inspect();
      state?.dispatchers.push(createDispatcher(1));
      state?.dispatchers.push(createDispatcher(2));
      state?.dispatchers.push(createDispatcher(3));
      window.dispatchEvent(new CustomEvent('router-dispatch', { detail: { path: '/' } }));
      assert.deepStrictEqual(logs, [1, 2, 3]);
    });
  });

  describe('push()', () => {
    it('push history', async () => {
      history.replaceState(null, '', '#!/1');
      history.pushState(null, '', '#!/2');
      configure({ mode: 'hash' });
      await push('/foo');
      assert.strictEqual(location.hash, '#!/foo');
      const dispatched = waitFor(window, 'router-dispatch');
      history.back();
      await dispatched;
      assert.strictEqual(location.hash, '#!/2');
    });
  });

  describe('replace()', () => {
    it('push history', async () => {
      history.replaceState(null, '', '#!/1');
      history.pushState(null, '', '#!/2');
      configure({ mode: 'hash' });
      await replace('/foo');
      assert.strictEqual(location.hash, '#!/foo');
      const dispatched = waitFor(window, 'router-dispatch');
      history.back();
      await dispatched;
      assert.strictEqual(location.hash, '#!/1');
    });
  });

  describe('go()', () => {
    it('go back and forth in history', async () => {
      history.replaceState(null, '', '#!/1');
      history.pushState(null, '', '#!/2');
      configure({ mode: 'hash' });
      await go(-1);
      assert.strictEqual(location.hash, '#!/1');
      await go(1);
      assert.strictEqual(location.hash, '#!/2');
    });
  });

  describe('pop()', () => {
    it('pop history', async () => {
      await pop();
      assert.strictEqual(location.hash, '#!/1');
    });
  });

  describe('Outlet', () => {
    describe('#render()', () => {
      it('render tag', async () => {
        const host = document.createElement('div');
        const outlet = new Outlet(host);
        await outlet.render({ path: '/', template: 'foo-bar' }, { path: '/' });
        assert.notStrictEqual(host.querySelector('foo-bar'), null);
      });

      it('render element', async () => {
        const host = document.createElement('div');
        const outlet = new Outlet(host);
        const route = {
          path: '/',
          template: document.createElement('foo-bar'),
        };
        await outlet.render(route, { path: '/' });
        assert.notStrictEqual(host.querySelector('foo-bar'), null);
      });

      it('render document fragment', async () => {
        const host = document.createElement('div');
        const outlet = new Outlet(host);
        const df = document.createDocumentFragment();
        df.appendChild(document.createElement('x-foo'));
        df.appendChild(document.createElement('x-bar'));
        const route = {
          path: '/',
          template: df,
        };
        await outlet.render(route, { path: '/' });
        assert.notStrictEqual(host.querySelector('x-foo'), null);
        assert.notStrictEqual(host.querySelector('x-bar'), null);
        assert.notStrictEqual(df.querySelector('x-foo'), null);
        assert.notStrictEqual(df.querySelector('x-bar'), null);
      });

      it('render function template', async () => {
        const host = document.createElement('div');
        const outlet = new Outlet(host);
        const route = {
          path: '/',
          template (ctx: { path: string }) {
            assert.strictEqual(ctx.path, '/foo');
            return Promise.resolve('foo-bar');
          },
        };
        await outlet.render(route, { path: '/foo' });
        assert.notStrictEqual(host.querySelector('foo-bar'), null);
      });

      it('render promise template', async () => {
        const host = document.createElement('div');
        const outlet = new Outlet(host);
        const route = {
          path: '/',
          template: Promise.resolve('foo-bar'),
        };
        await outlet.render(route, { path: '/' });
        assert.notStrictEqual(host.querySelector('foo-bar'), null);
      });

      it('set ctx property of template', async () => {
        const host = document.createElement('div');
        const outlet = new Outlet(host);
        const el: HTMLElement & { ctx?: unknown } = document.createElement('foo-bar');
        const route = {
          path: '/',
          template: el,
        };
        const ctx = { path: '/' };
        await outlet.render(route, ctx);
        assert.deepStrictEqual(el.ctx, ctx);
      });
    });
  });

  describe('Middlewares', () => {
    describe('#push()', () => {
      it('push middlewares', () => {
        const m1 = () => Promise.resolve();
        const m2 = () => Promise.resolve();
        const middlewares = new Middlewares();
        middlewares.push(m1, m2);
        assert.strictEqual(middlewares.length, 2);
        assert.strictEqual(middlewares.middlewares[0], m1);
        assert.strictEqual(middlewares.middlewares[1], m2);
      });
    });

    describe('#invoke()', () => {
      it('invoke all middlewares', async () => {
        const logs: string[] = [];
        const middlewares = new Middlewares();
        middlewares.push(
          async (_, next) => {
            logs.push('m11');
            await next();
            logs.push('m12');
          },
          async (_: unknown, next) => {
            logs.push('m21');
            await next();
            logs.push('m22');
          },
        );
        await middlewares.invoke({ path: '/' }, () => {
          logs.push('next');
          return Promise.resolve();
        });
        assert.deepStrictEqual(logs, ['m11', 'm21', 'next', 'm22', 'm12']);
      });
    });
  });

  describe('Routes', () => {
    describe('#push()', () => {
      it('push routes', () => {
        const routes = new Routes();
        routes.push({ path: '/', template: 'x-home' }, { path: '/foo', template: 'x-foo' });
        assert.strictEqual(routes.length, 2);
        assert.strictEqual(routes.routes[0].path, '/');
        assert.strictEqual(routes.routes[1].path, '/foo');
      });
    });

    describe('#for()', () => {
      const routes = new Routes();
      const table: {
        path: string,
        template: string,
        params?: Record<string, string>,
      }[] = [
        { path: '/', template: 'x-home' },
        { path: '/foo', template: 'x-foo' },
        { path: '/bar/1', template: 'x-bar', params: { id: '1' } },
        { path: '/bar/2', template: 'x-bar', params: { id: '2' } },
      ];

      before(() => {
        routes.push(
          { path: '/', template: 'x-home' },
          { path: '/foo', template: 'x-foo' },
          { path: '/bar/{id}', template: 'x-bar' },
        );
      });

      for (const tt of table) {
        it(`resolve route with path ${tt.path}`, () => {
          const [route, ctx] = routes.forContext({ path: tt.path });
          assert.strictEqual(ctx.path, tt.path);
          assert.strictEqual(route.template, tt.template);
          assert.deepStrictEqual(ctx.params, tt.params);
        });
      }
    });
  });

  describe('Router', () => {
    describe('constructor', () => {
      it('create new router with default value', () => {
        const router = new Router();
        assert.strictEqual((<Outlet>router.outlet).host, document.body);
        assert.strictEqual(router.basePath, '/');
        assert.strictEqual(router.routes.length, 0);
        assert.strictEqual(router.middlewares.length, 0);
      });

      it('create new router with specified outlet and options', () => {
        const el = document.createElement('div');
        const opts = {
          basePath: '/x',
          routes: [
            { path: '/foo', template: 'x-foo' },
            { path: '/bar', template: 'x-bar' },
          ],
          middlewares: [
            () => Promise.resolve(),
            () => Promise.resolve(),
            () => Promise.resolve(),
          ],
        };
        const router = new Router(el, opts);
        assert.strictEqual((<Outlet>router.outlet).host, el);
        assert.strictEqual(router.basePath, '/x');
        assert.strictEqual(router.routes.length, 2);
        assert.strictEqual(router.middlewares.length, 3);
      });
    });

    describe('#use()', () => {
      it('add middlewares', () => {
        const router = new Router();
        router.use(() => Promise.resolve(), () => Promise.resolve());
        assert.strictEqual(router.middlewares.length, 2);
      });
    });

    describe('#route()', () => {
      it('add routes', () => {
        const router = new Router();
        router.route(
          { path: '/foo', template: 'x-foo' },
          { path: '/bar', template: 'x-bar' },
        );
        assert.strictEqual(router.routes.length, 2);
      });
    });

    describe('#dispatch()', () => {
      it('return false on invalid prefix', async () => {
        const outlet = document.createElement('div');
        const router = new Router(outlet, { basePath: '/foo' });
        const result = await router.dispatch({ path: '/bar' });
        assert.strictEqual(result, false);
      });

      it('throw error if route is not resolved', async () => {
        const router = new Router(document.createElement('div'));
        try {
          await router.dispatch({ path: '/' });
          throw new Error('must throw err');
        } catch (err) {
          if (err.message === 'must throw err') {
            throw err;
          }
          assert.strictEqual(err.message, 'route not found');
        }
      });

      it('invoke middlewares, resolve route and render outlet', async () => {
        const logs: string[] = [];
        const router = new Router(document.createElement('div'), {
          middlewares: [
            async (_, next) => {
              logs.push('m1');
              await next();
              logs.push('m2');
            },
            async (_, next) => {
              logs.push('n1');
              await next();
              logs.push('n2');
            },
          ],
          routes: [
            { path: '/', template: 'x-home' },
          ],
        });
        router.outlet = {
          render (route, ctx) {
            assert.strictEqual(route.template, 'x-home');
            assert.strictEqual(ctx.path, '/');
            return Promise.resolve();
          },
        };
        const result = await router.dispatch({ path: '/' });
        assert.strictEqual(result, true);
        assert.deepStrictEqual(logs, ['m1', 'n1', 'n2', 'm2']);
      });
    });

    describe('#listen()', () => {
      it('add to dispatchers', () => {
        configure();
        const router = new Router(document.createElement('div:w'));
        router.route({ path: '*', template: 'foo' });
        router.listen();
        assert.strictEqual(inspect()?.dispatchers.length, 1);
      });
    });

    describe('#unlisten()', () => {
      it('remove from dispatchers', () => {
        configure();
        const router = new Router();
        inspect()?.dispatchers.push(router);
        router.unlisten();
        assert.strictEqual(inspect()?.dispatchers.length, 0);
      });
    });
  });

  describe('@router()', () => {
    it('define base path, routes, and middlewares from options', async () => {
      const options = {
        basePath: '/foo',
        routes: [
          { path: '/', template: 'x-home' },
        ],
        middlewares: [
          () => Promise.resolve(),
        ],
      };
      class XRouter extends router(options)(HTMLElement) {}
      customElements.define('x-router-1', XRouter);
      const el: XRouter = await fixture(html`
        <x-router-1></x-router-1>
      `);
      assert.strictEqual((el.router?.outlet as Outlet).host, el);
      assert.strictEqual(el.router?.basePath, '/foo');
      assert.strictEqual(el.router?.routes.length, 1);
      assert.strictEqual(el.router?.middlewares.length, 1);
    });

    it('define outlet, routes and middlewares from children', async () => {
      const mw = () => Promise.resolve();
      const el: HRouter = await fixture(html`
        <h-router>
          <div>
            <div outlet id="outlet"></div>
          </div>
          <template route path="/" template="x-foo"></template>
          <template route path="/bar">
            <x-bar></x-bar>
          </template>
          <x-m middleware .callback="${mw}"></x-m>
          <div class="excluded">
            <template route path="/foo" template="x-foo-excluded"></template>
            ,<x-m middleware .callback="${mw}"></x-m>
          </div>
        </h-router>
      `);
      assert.strictEqual((el.router?.outlet as Outlet).host, el.querySelector('#outlet'));
      assert.strictEqual(el.router?.routes.length, 2);
      assert.strictEqual(el.router?.middlewares.length, 1);
    });

    it('listen if has attribute listen', async () => {
      const el: HRouter = await fixture(html`
        <h-router listen>
          <div>
            <div outlet id="outlet"></div>
          </div>
          <template route path="/" template="x-foo"></template>
          <template route path="/bar">
            <x-bar></x-bar>
          </template>
        </h-router>
      `);
      assert.notStrictEqual(el.querySelector('x-foo'), null);
    });
  });
});

class HRouter extends router()(HTMLElement) {}
customElements.define('h-router', HRouter);

function waitFor (target: EventTarget, name: string, timeoutLength = 500): Promise<Event> {
  return new Promise<Event>((resolve, reject) => {
    function clean () {
      clearTimeout(t);
      target.removeEventListener(name, handle);
    }
    const t = setTimeout(() => {
      clean();
      reject(new Error(`wait for event '${name}' got timeout`));
    }, timeoutLength);
    const handle = (evt: Event) => {
      clean();
      resolve(evt);
    };
    target.addEventListener(name, handle);
  });
}
