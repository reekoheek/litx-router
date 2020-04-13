import { Context } from './context';
import { Route } from './route';
import { compose } from './compose';

const kStateListener = Symbol('state_listener');
const kLinkListener = Symbol('link_listener');

export class Router extends HTMLElement {
  constructor () {
    super();

    this.middlewareSelector = '[middleware]';
    this.routeSelector = 'litx-route';
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
    this.defaultMarker = document.createComment('router-marker');
  }

  getMiddlewareChain () {
    if (!this.middlewares.chain) {
      this.middlewares.chain = compose(this.middlewares);
    }

    return this.middlewares.chain;
  }

  async connectedCallback () {
    this.debug = this.hasAttribute('debug');
    this.mode = this.getAttribute('mode') || this.mode;
    this.hash = this.getAttribute('hash') || this.hash;
    this.root = this.getAttribute('root') || this.root;
    this.manual = this.hasAttribute('manual');
    this.middlewareSelector = this.getAttribute('middleware-selector') || this.middlewareSelector;
    this.routeSelector = this.getAttribute('route-selector') || this.routeSelector;

    this.populateRoutes();
    this.populateMiddlewares();

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
        uri = this.root === '/' ? uri : uri.replace(this.root, '');
      } else {
        const match = location.href.match(this.hashRegexp);
        uri = match ? match[1] : '';
      }

      return '/' + uri.toString().replace(/\/$/, '').replace(/^\//, '');
    } catch (err) {
      /* istanbul ignore next  */
      console.error('Fragment is not match any pattern, fallback to /\n', err);
      return '/';
    }
  }

  async start () {
    if (this.started) {
      throw new Error('Router already started');
    }

    this.started = true;

    this.appendChild(this.defaultMarker);

    this.setupListener();

    const uri = this.getUri(this.location);
    await this.dispatch(new Context({ uri }));
  }

  stop () {
    this.started = false;

    this.teardownListener();
  }

  populateRoutes () {
    /* istanbul ignore if  */
    if (this.routes.length) {
      return;
    }

    this.querySelectorAll(this.routeSelector).forEach(route => {
      const uri = route.getAttribute('uri');
      const view = route.getAttribute('view');
      const marker = route;

      /* istanbul ignore if  */
      if (!uri || !view) {
        throw new Error(`Malformed route ${route.outerHTML}`);
      }

      this.addRoute({ uri, view, marker });
    });
  }

  populateMiddlewares () {
    /* istanbul ignore if  */
    if (this.middlewares.length) {
      return;
    }

    this.querySelectorAll(this.middlewareSelector).forEach(mw => {
      /* istanbul ignore if  */
      if (typeof mw.callback !== 'function') {
        throw new Error(`Middleware: ${mw.nodeName} must implement callback()`);
      }

      mw.router = this;
      this.use(mw.callback());
    });
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
    const chain = this.getMiddlewareChain();
    await chain(ctx, async () => {
      await this.route(ctx);
    });

    const evt = new CustomEvent('router-dispatch', { ctx });
    this.dispatchEvent(evt);
  }

  /**
   * Add route
   * @param {object} route Route definition
   * @param {string} route.uri
   * @param {string} route.view
   * @param {Element} route.marker
   */
  addRoute ({ uri, view, props, marker = this.defaultMarker }) {
    this.routes.push(new Route({ uri, view, props, marker }));
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

    await this.prepare(entering.view);

    await Promise.all([
      entering.enter(ctx),
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
      throw new Error('Cannot go nowhere');
    }

    this.history.go(delta);

    await this.dispatchComplete;
  }

  async prepare (view) {
    if (customElements.get(view)) {
      return;
    }

    function test (view, loader) {
      if (loader.test === true) return true;
      if (typeof loader.test === 'function' && loader.test(view)) return true;
      if (loader.test instanceof RegExp && loader.test.test(view)) return true;
    }

    for (const loader of this.loaders) {
      if (test(view, loader)) {
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
