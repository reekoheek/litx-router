import { Context } from './context';
import { Route } from './route';
import { compose } from './compose';

const kStateListener = Symbol('state_listener');
const kLinkListener = Symbol('link_listener');

export class Router extends HTMLElement {
  constructor () {
    super();

    this.loaders = [];
    this.started = false;
    this.debug = false;
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
    this.debug = this.hasAttribute('debug');
    this.mode = this.getAttribute('mode') || this.mode;
    this.hash = this.getAttribute('hash') || this.hash;
    this.root = this.getAttribute('root') || this.root;
    this.manual = this.hasAttribute('manual');

    if (!this.manual) {
      await this.start();
    }
  }

  disconnectedCallback () {
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
      console.error('Fragment is not match any pattern, fallback to /\n', err);
      return '/';
    }
  }

  async start () {
    if (this.started) {
      throw new Error('Router already started');
    }

    this.started = true;

    this.setupRoutes();
    this.setupMiddlewares();
    this.setupListener();

    const uri = this.getUri(this.location);
    await this.dispatch(new Context({ uri }));
  }

  stop () {
    this.started = false;

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
    this[kStateListener] = async evt => {
      const uri = this.getUri(this.location);
      await this.dispatch(new Context({ uri, state: evt.state }));
    };

    window.addEventListener('popstate', this[kStateListener]);

    this[kLinkListener] = async evt => {
      const link = evt.target.closest('a');
      if (!link) {
        return;
      }

      const href = link.getAttribute('href');
      if (href[0] !== '/') {
        return;
      }

      evt.preventDefault();
      await this.push(href);
    };

    window.addEventListener('click', this[kLinkListener]);
  }

  teardownListener () {
    if (this[kStateListener]) {
      window.removeEventListener('popstate', this[kStateListener]);
      this[kStateListener] = undefined;
    }

    if (this[kLinkListener]) {
      window.removeEventListener('click', this[kLinkListener]);
      this[kLinkListener] = undefined;
    }
  }

  async dispatch (ctx) {
    this.ctx = ctx;

    // ctx = ctx.shift(this);

    /* istanbul ignore if  */ if (this.debug) console.info(`Dispatching ${this.nodeName} with ctx: %O`, ctx);
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

  async push (uri, state) {
    if (this.ctx.uri === uri) {
      return;
    }

    /* istanbul ignore if  */ if (this.debug) console.info(`Push ${this.nodeName} %s`, uri);

    this.history.pushState(state, document.title, this.uriToUrl(uri));
    await this.dispatch(new Context({ uri, state }));
  }

  async replace (uri, state) {
    if (this.ctx.uri === uri) {
      return;
    }

    /* istanbul ignore if  */ if (this.debug) console.info(`Replace ${this.nodeName} %s`, uri);

    this.history.replaceState(state, document.title, this.uriToUrl(uri));
    await this.dispatch(new Context({ uri, state }));
  }

  async pop () {
    /* istanbul ignore if  */ if (this.debug) console.info(`Pop ${this.nodeName}`);

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

  uriToUrl (uri) {
    return this.mode === 'history'
      ? this.root + uri.toString().replace(/\/$/, '').replace(/^\//, '')
      : this.hash + uri;
  }
}

customElements.define('litx-router', Router);
