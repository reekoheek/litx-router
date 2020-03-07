import { LitElement } from 'lit-element';
import { Context } from './context';
import { Route } from './route';
import { compose } from './compose';

export class Router extends LitElement {
  static get properties () {
    return {
      loaders: { type: Array },
      mode: { type: String },
      hash: { type: String },
      root: { type: String },
      manual: { type: Boolean },
    };
  }

  constructor () {
    super();

    this.loaders = [];
    this.mode = 'hash';
    this.hash = '#!';
    this.root = '/';
    this.manual = false;
    this.routes = [];
    this.middlewares = [];
    this.location = window.location;
    this.history = window.history;
    this.hashRegexp = new RegExp(`${this.hash}(.*)$`);
  }

  async connectedCallback () {
    super.connectedCallback();

    if (!this.manual) {
      await this.start();
    }
  }

  disconnectedCallback () {
    super.disconnectedCallback();
    this.stop();
  }

  use (middleware) {
    this.middlewares.push(middleware);
  }

  getUri (location) {
    try {
      let uri;
      if (this.mode === 'history') {
        uri = decodeURI(location.pathname + location.search);
        uri = uri.replace(/\?(.*)$/, '');
        uri = this.root === '/' ? uri : uri.replace(this.root, '');
      } else {
        const match = location.href.match(this.hashRegexp);
        uri = match ? match[1] : '';
      }

      return '/' + uri.toString().replace(/\/$/, '').replace(/^\//, '');
    } catch (err) {
      console.error('Fragment is not match any pattern, fallback to /');
      console.error(err);
      return '/';
    }
  }

  async start () {
    this.setupRoutes();
    this.setupMiddlewares();
    this.setupListener();

    const uri = this.getUri(this.location);
    await this.dispatch(new Context({ uri }));
  }

  stop () {
    this.teardownListener();
    this.teardownMiddlewares();
    this.teardownRoutes();
  }

  setupRoutes () {
    this.routes = [];
    this.querySelectorAll('litx-route').forEach(route => {
      const uri = route.getAttribute('uri');
      const view = route.getAttribute('view');
      const marker = route;

      if (!uri || !view) {
        throw new Error(`Malformed route ${route.outerHTML}`);
      }

      this.routes.push(new Route({ router: this, uri, view, marker }));
    });
  }

  teardownRoutes () {
    this.routes = [];
  }

  setupMiddlewares () {
    this.querySelectorAll('[middleware]').forEach(mw => {
      mw.router = this;
      if (typeof mw.callback === 'function') {
        this.use(mw.callback());
      } else {
        console.error(`Middleware: ${mw.nodeName} must implement callback()`);
      }
    });
    this.middlewareChain = compose(this.middlewares);
  }

  teardownMiddlewares () {
    this.middlewares = [];
    this.middlewareChain = undefined;
  }

  setupListener () {
    this.listener = async () => {
      const uri = this.getUri(this.location);
      await this.dispatch(new Context({ uri }));
    };

    window.addEventListener('popstate', this.listener);
  }

  teardownListener () {
    if (this.listener) {
      window.removeEventListener('popstate', this.listener);
      this.listener = undefined;
    }
  }

  async dispatch (ctx) {
    this.currentUri = ctx.uri;

    ctx = ctx.shift(this);

    console.info(`Dispatching ${this.nodeName} with ctx: %O`, ctx);
    await this.middlewareChain(ctx, async () => {
      await this.route(ctx);
    });

    const evt = new CustomEvent('router-dispatch', { ctx });
    this.dispatchEvent(evt);
  }

  async route (ctx) {
    let entering;
    let leaving;
    this.routes.forEach(route => {
      if (!entering && route.test(ctx.pathname)) {
        entering = route;
      } else if (route.active) {
        leaving = route;
      }
    });

    if (!entering) {
      throw new Error(`Route not found! (uri:${ctx.originalUri})`);
    }

    await Promise.all([
      entering && entering.enter(ctx),
      leaving && leaving.leave(),
    ]);
  }

  async push (uri, data) {
    console.info(`Push ${this.nodeName} %s`, uri);

    if (this.currentUri === uri) {
      return;
    }

    const url = this.mode === 'history'
      ? this.rootUri + uri.toString().replace(/\/$/, '').replace(/^\//, '')
      : this.hash + (uri === '/' ? '' : uri);

    this.history.pushState(data, document.title, url);
    await this.dispatch(new Context({ uri, data }));
  }

  async replace (uri, data) {
    console.info(`Replace ${this.nodeName} %s`, uri);

    if (this.currentUri === uri) {
      return;
    }

    const url = this.mode === 'history'
      ? this.rootUri + uri.toString().replace(/\/$/, '').replace(/^\//, '')
      : this.hash + uri;

    this.history.replaceState(data, document.title, url);
    await this.dispatch(new Context({ uri, data }));
  }

  async pop () {
    await this.go(-1);
  }

  async go (delta) {
    this.dispatchComplete = new Promise(resolve => {
      const done = () => {
        this.removeEventListener('router-dispatch', done);
        resolve();
      };

      this.addEventListener('router-dispatch', done);
    });

    if (!delta) {
      return;
    }

    this.history.go(delta);

    await this.dispatchComplete;
  }

  async prepare (view) {
    for (const loader of this.loaders) {
      if (loader.test(view)) {
        await loader.load(view);
      }
    }
  }
}

customElements.define('litx-router', Router);
