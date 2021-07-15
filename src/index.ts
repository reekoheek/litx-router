type Mode = 'history' | 'hash'

interface Context {
  readonly path: string;
  readonly query?: Record<string, string>;
  readonly params?: Record<string, string>;
  readonly state?: unknown;
}

interface WithContext {
  ctx?: Context;
}

function compareContext (ctx1: Context, ctx2: Context): boolean {
  if (ctx1.path !== ctx2.path) {
    return false;
  }
  const q1 = ctx1.query || {};
  const q2 = ctx2.query || {};
  const s = new Set([...Object.keys(q1), ...Object.keys(q2)]);
  for (const k of s) {
    if (q1[k] !== q2[k]) {
      return false;
    }
  }
  return true;
}

interface Location {
  readonly pathname: string,
  readonly search: string,
  readonly hash: string,
}

type DOMTemplate = HTMLElement | DocumentFragment;
type TagTemplate = string;
type BasicTemplate = DOMTemplate | TagTemplate;

interface FunctionTemplate {
  (ctx: Context): Promise<BasicTemplate>;
}

type Template = BasicTemplate | FunctionTemplate | Promise<BasicTemplate>;

interface WithTemplate {
  readonly template: Template;
}

interface RouteDef extends WithTemplate {
  readonly path: string;
}

interface Route extends RouteDef {
  readonly pattern?: RegExp;
  readonly args?: string[];
}

interface NextFn {
  (): Promise<void>;
}

interface Middleware {
  (ctx: Context, next: NextFn): Promise<void>;
}

interface WithMiddlewareCallback {
  readonly callback: Middleware;
}

interface Constructor<T> {
  new (...args: any[]): T; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface MaybeCustomeElement extends HTMLElement {
  connectedCallback?(): void;
  disconnectedCallback?(): void;
}

interface Options {
  readonly basePath: string;
  readonly middlewares: Middleware[];
  readonly routes: RouteDef[];
}

interface MixinOptions extends Options {
  readonly listen: boolean;
}

interface Dispatcher {
  dispatch (ctx: Context): Promise<boolean>;
}

interface IOutlet {
  render (route: Route, ctx: Context): Promise<void>;
}

interface RouteResolver {
  (el: Element): Route;
}

interface MiddlewareResolver {
  (el: Element): Middleware;
}

interface Config {
  readonly mode: Mode;
  readonly delay: number;
  readonly routeResolver: RouteResolver;
  readonly middlewareResolver: MiddlewareResolver;
}

interface Debug {
  popStateEventListener?: EventListener;
  clickEventListener?: EventListener;
  routerDispatchEventListener?: EventListener;
}

interface State {
  config: Config;
  ctx: Context;
  dispatchers: Dispatcher[];
}

let globalDebug: Debug | undefined;
let globalState: State | undefined;

function fireEvent (ctx: Context) {
  const evt = new CustomEvent<Context>('router-dispatch', {
    detail: ctx,
  });
  window.dispatchEvent(evt);
}

function handlePopState (evt: PopStateEvent) {
  if (globalDebug?.popStateEventListener) {
    globalDebug.popStateEventListener(evt);
    return;
  }
  try {
    const parsed = parseLocation(location, getState().config.mode);
    const ctx = { ...parsed, state: evt.state };
    fireEvent(ctx);
  } catch (err) {
    console.error('unhandled popstate err', err);
  }
}

function handleClick (evt: Event) {
  if (globalDebug?.clickEventListener) {
    globalDebug.clickEventListener(evt);
    return;
  }
  try {
    if (evt.target instanceof Element === false) {
      return;
    }
    const target = (evt.target as Element).closest('a');
    if (!target) {
      return;
    }
    evt.preventDefault();
    const parsed = parseLocation(target, getState().config.mode);
    history.pushState(null, '', target.href);
    const ctx = { ...parsed };
    fireEvent(ctx);
  } catch (err) {
    console.error('unhandled click err', err);
  }
}

function isRouterDispatchEvent (evt: Event): evt is CustomEvent<Context> {
  return Boolean((evt as CustomEvent<Context>).detail?.path);
}

function handleRouterDispatch (evt: Event) {
  if (globalDebug?.routerDispatchEventListener) {
    globalDebug.routerDispatchEventListener(evt);
    return;
  }
  try {
    if (!isRouterDispatchEvent(evt)) {
      throw new Error('invalid router dispatch event');
    }
    const ctx = evt.detail;
    const state = getState();
    const eq = compareContext(ctx, state.ctx);
    if (eq) {
      return;
    }
    state.ctx = ctx;
    state.dispatchers.forEach(dispatcher => tryDispatch(dispatcher, ctx));
  } catch (err) {
    console.error('unhandled router-dispatch err', err);
  }
}

async function tryDispatch (dispatcher: Dispatcher, ctx: Context) {
  try {
    const dispatched = await dispatcher.dispatch(ctx);
    if (!dispatched && globalDebug) {
      console.warn('skip dispatching...');
    }
  } catch (err) {
    console.error('dispatch err', err);
  }
}

function addDispatcher (dispatcher: Dispatcher) {
  const { dispatchers } = getState();
  const index = dispatchers.indexOf(dispatcher);
  if (index !== -1) {
    return;
  }
  dispatchers.push(dispatcher);
}

function removeDispatcher (dispatcher: Dispatcher) {
  const { dispatchers } = getState();
  const index = dispatchers.indexOf(dispatcher);
  if (index !== -1) {
    dispatchers.splice(index, 1);
  }
}

export function push (uri: string, state?: unknown): Promise<void> {
  history.pushState(state, '', toURLString(uri, getState().config.mode));
  fireEvent({ ...parseURI(uri), state });
  return Promise.resolve();
}

export function replace (uri: string, state?: unknown): Promise<void> {
  history.replaceState(state, '', toURLString(uri, getState().config.mode));
  fireEvent({ ...parseURI(uri), state });
  return Promise.resolve();
}

export async function go (delta: number): Promise<void> {
  const triggered = waitFor(window, 'popstate');
  history.go(delta);
  await triggered;
  return Promise.resolve();
}

export async function pop (): Promise<void> {
  await go(-1);
}

export function debug (debug?: Partial<Debug> | boolean): Debug | undefined {
  if (debug === true) {
    globalDebug = {};
  } else if (debug === false) {
    globalDebug = undefined;
  } else if (debug) {
    globalDebug = { ...globalDebug, ...debug };
  }
  return globalDebug;
}

function initState (): State {
  globalState = {
    config: {
      mode: 'history',
      delay: 300,
      routeResolver: defaultRouteResolver,
      middlewareResolver: defaultMiddlewareResolver,
    },
    ctx: { path: '/' },
    dispatchers: [],
  };
  window.addEventListener('popstate', handlePopState);
  window.addEventListener('click', handleClick);
  window.addEventListener('router-dispatch', handleRouterDispatch);
  return globalState;
}

function uninitState () {
  if (!globalState) {
    return;
  }
  globalState = undefined;
  window.removeEventListener('popstate', handlePopState);
  window.removeEventListener('click', handleClick);
  window.removeEventListener('router-dispatch', handleRouterDispatch);
}

function getState (): State {
  if (globalState) {
    return globalState;
  }
  throw new Error('uninitialized router global state');
}

export function inspect (): State | undefined {
  if (!globalDebug) {
    throw new Error('disable inspect without debug');
  }
  return globalState;
}

export function configure (config: Partial<Config> = {}): void {
  if (!globalState) {
    globalState = initState();
  }
  const state = globalState;
  state.config = {
    ...state.config,
    ...config,
  };
  state.ctx = parseLocation(location, state.config.mode);
}

export function reset (): void {
  uninitState();
}

function toURLString (uri: string, mode: Mode): string {
  return mode === 'hash' ? '#!' + uri : '/' + uri.replace(/\/+$/, '').replace(/^\/+/, '');
}

function parseURL ({ pathname, searchParams }: URL): Context {
  const query: Record<string, string> = {};
  searchParams.forEach((v, k) => (query[k] = v));
  return { path: pathname, query };
}

function parseURI (uri: string): Context {
  return parseURL(new URL(uri, 'http://localhost'));
}

function parseLocation (location: Location, mode: Mode): Context {
  let uri = '';
  if (mode === 'history') {
    uri += decodeURI(location.pathname + location.search);
  } else {
    const match = location.hash.match(/#!(.*)/);
    if (match && match[1]) {
      uri += match[1];
    }
  }
  uri = '/' + uri.replace(/\/+$/, '').replace(/^\/+/, '');
  return parseURI(uri);
}

function toRoute (route: RouteDef): Route {
  if (!isVary(route.path)) {
    return { ...route };
  }
  return {
    ...route,
    ...parseRegExp(route.path),
  };
}

function parseRegExp (str: string) {
  const chunks = str.split('[');
  if (chunks.length > 2) {
    throw new Error('Invalid use of optional params');
  }
  const args: string[] = [];
  const re = chunks[0].replace(/{([^}]+)}/g, function (_, token) {
    args.push(token);
    return '([^/]+)';
  }).replace(/\//g, '\\/');
  let optRe = '';
  if (chunks[1]) {
    optRe = '(?:' + chunks[1].slice(0, -1).replace(/{([^}]+)}/g, function (_, token) {
      const [realToken, re = '[^/]+'] = token.split(':');
      args.push(realToken);
      return `(${re})`;
    }).replace(/\//g, '\\/') + ')?';
  }
  return { pattern: new RegExp('^' + re + optRe + '$'), args };
}

function isVary (path: string) {
  return path.match(/[[{]/);
}

export class Middlewares {
  middlewares: Middleware[] = [];

  get length (): number {
    return this.middlewares.length;
  }

  push (...middlewares: Middleware[]): void {
    this.middlewares.push(...middlewares);
  }

  invoke (ctx: Context, next: NextFn): Promise<void> {
    const middlewares = this.middlewares;
    let index = -1;
    const dispatch = (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;
      const fn = i === middlewares.length ? next : middlewares[i];
      return fn(ctx, () => dispatch(i + 1));
    };
    return dispatch(0);
  }
}

function toOptions ({
  basePath = '/',
  middlewares = [],
  routes = [],
}: Partial<Options> = {}): Options {
  return { basePath, middlewares, routes };
}

async function resolveTemplate (route: Route, ctx: Context): Promise<DOMTemplate> {
  let template = route.template;
  if (route.template instanceof Promise) {
    template = await route.template;
  }
  if (typeof route.template === 'function') {
    template = await route.template(ctx);
  }
  if (template instanceof HTMLElement) {
    return template;
  }
  if (template instanceof DocumentFragment) {
    return document.importNode(template, true);
  }
  if (typeof template === 'string') {
    return document.createElement(template);
  }
  throw new Error('unimplemented template');
}

function createContextWithSegmentParams (ctx: Context, route: Route): Context {
  if (!route.pattern) {
    throw new Error('invalid route pattern');
  }
  const result = ctx.path.match(route.pattern);
  if (!result) {
    throw new Error('invalid route pattern');
  }
  return {
    ...ctx,
    params: (route.args ?? []).reduce((params: Record<string, string>, name: string, index: number) => {
      params[name] = result[index + 1];
      return params;
    }, {}),
  };
}

export class Routes {
  routes: Route[] = [];

  get length (): number {
    return this.routes.length;
  }

  push (...routes: RouteDef[]): void {
    routes.forEach(r => this.routes.push(toRoute(r)));
  }

  forContext (ctx: Context): [Route, Context] {
    const route = this.routes.find(route => {
      if (route.pattern) {
        return ctx.path.match(route.pattern);
      }
      return route.path === '*' || route.path === ctx.path;
    });
    if (!route) {
      throw new Error('route not found');
    }
    if (route.pattern) {
      ctx = createContextWithSegmentParams(ctx, route);
    }
    return [route, ctx];
  }
}

export class Outlet implements IOutlet {
  host: Element;
  marker: Comment;

  constructor (host: Element) {
    this.host = host;
    this.marker = document.createComment('');
    this.host.appendChild(this.marker);
  }

  async render (route: Route, ctx: Context): Promise<void> {
    const template = await resolveTemplate(route, ctx);
    (<WithContext>template).ctx = ctx;
    while (this.marker.nextSibling) {
      this.host.removeChild(this.marker.nextSibling);
    }
    this.host.appendChild(template);
  }
}

function createPrefixRemovedContext (ctx: Context, prefix: string): Context {
  return { ...ctx, path: '/' + ctx.path.substr(prefix.length).replace(/^\/+/, '') };
}

export class Router implements Dispatcher {
  outlet: IOutlet;
  basePath: string;
  routes = new Routes();
  middlewares = new Middlewares();

  constructor (outlet: Element = document.body, opts?: Partial<Options>) {
    const { basePath, routes, middlewares } = toOptions(opts);
    this.outlet = new Outlet(outlet);
    this.basePath = basePath;
    this.use(...middlewares);
    this.route(...routes);
  }

  async listen (): Promise<void> {
    if (!globalState) {
      configure();
    }
    addDispatcher(this);
    const { ctx } = getState();
    await this.dispatch(ctx);
  }

  unlisten (): void {
    if (!globalState) {
      return;
    }
    removeDispatcher(this);
  }

  use (...middlewares: Middleware[]): Router {
    this.middlewares.push(...middlewares);
    return this;
  }

  route (...routes: RouteDef[]): Router {
    this.routes.push(...routes);
    return this;
  }

  async dispatch (ctx: Context): Promise<boolean> {
    if (!ctx.path.startsWith(this.basePath)) {
      return false;
    }
    ctx = createPrefixRemovedContext(ctx, this.basePath);
    await this.middlewares.invoke(ctx, async () => {
      await this.outlet.render(...this.routes.forContext(ctx));
    });
    return true;
  }
}

function findRoutesAndMiddlewares (root: Element | DocumentFragment): [ RouteDef[], Middleware[] ] {
  const { routeResolver, middlewareResolver } = getState().config;
  const routes: RouteDef[] = [];
  const mws: Middleware[] = [];
  let child = root.firstElementChild;
  while (child) {
    if (child.hasAttribute('route')) {
      routes.push(routeResolver(child));
    }

    if (child.hasAttribute('middleware')) {
      mws.push(middlewareResolver(child));
    }
    child = child.nextElementSibling;
  }
  return [routes, mws];
}

function defaultRouteResolver (el: Element): RouteDef {
  const path = el.getAttribute('path');
  let template = (el as Partial<WithTemplate>).template ?? el.getAttribute('template');
  if (!template && el instanceof HTMLTemplateElement) {
    template = document.importNode(el.content, true);
  }
  if (path && template) {
    return { path, template };
  }
  throw new Error('malformed route');
}

function defaultMiddlewareResolver (el: Element): Middleware {
  const mw = (el as Partial<WithMiddlewareCallback>).callback;
  if (mw) {
    return mw;
  }
  throw new Error('malformed middleware');
}

interface IRouterElement {
  readonly router: Router;
  routerReady?: Promise<void>;
}

export function router (opts: Partial<MixinOptions> = {}) {
  return function <TBase extends Constructor<MaybeCustomeElement>> (Base: TBase): TBase & Constructor<IRouterElement> {
    return class extends Base {
      router!: Router;
      routerReady?: Promise<void>;

      get routerRoot (): Element | DocumentFragment {
        return this.shadowRoot ?? this;
      }

      connectedCallback () {
        if (super.connectedCallback) {
          super.connectedCallback();
        }
        this.routerReady = this.__enableRouter();
      }

      disconnectedCallback () {
        if (super.disconnectedCallback) {
          super.disconnectedCallback();
        }
        this.__disableRouter();
      }

      async __enableRouter (): Promise<void> {
        if (!globalState) {
          configure();
        }
        await sleep(getState().config.delay);
        const outlet = this.routerRoot.querySelector('[outlet]') ?? this;
        this.router = new Router(outlet, opts);
        const [routes, mws] = findRoutesAndMiddlewares(this.routerRoot);
        this.router.route(...routes);
        this.router.use(...mws);
        if (opts.listen || this.hasAttribute('listen')) {
          await this.router.listen();
        }
      }

      async __disableRouter () {
        await this.routerReady;
        if (!globalState) {
          return;
        }
        if (this.router) {
          this.router.unlisten();
        }
      }
    };
  };
}

interface Navigator {
  push (path: string, state: unknown): Promise<void>;
  replace (path: string, state: unknown): Promise<void>;
  pop (): Promise<void>;
  go (delta: number): Promise<void>;
}

export function navigator () {
  return function <TBase extends Constructor<MaybeCustomeElement>> (Base: TBase): TBase & Constructor<Navigator> {
    return class extends Base {
      push (path: string, state: unknown): Promise<void> {
        return push(path, state);
      }

      replace (path: string, state: unknown): Promise<void> {
        return replace(path, state);
      }

      pop (): Promise<void> {
        return pop();
      }

      go (delta: number): Promise<void> {
        return go(delta);
      }
    };
  };
}

export class RouterElement extends navigator()(router()(HTMLElement)) {}
customElements.define('litx-router', RouterElement);

interface LoadFn {
  (template: string, ctx: Context): Promise<unknown>;
}

export function lazy (template: string, load: LoadFn): FunctionTemplate {
  return async (ctx: Context) => {
    await load(template, ctx);
    return template;
  };
}

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

function sleep (t = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, t));
}
