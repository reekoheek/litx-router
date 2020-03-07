const { URL } = window;

export class Context {
  constructor (ctx) {
    if (ctx instanceof Context) {
      this.originalUri = ctx.originalUri;
      this.uri = ctx.uri;
      this.pathname = ctx.pathname;
      this.search = ctx.search;
      this.query = ctx.query;
    } else {
      this.originalUri = ctx.originalUri || ctx.uri;
      this._setUri(ctx.uri);
    }

    this.data = { ...ctx.data };
    this.parameters = { ...ctx.parameters };
  }

  _setUri (uri) {
    this.uri = uri;
    let { pathname, search } = new URL(uri, 'http://localhost');
    if (search[0] === '?') {
      search = search.substr(1);
    }

    this.pathname = pathname;
    this.search = search;
    this.query = parse(search);
  }

  withUri (uri) {
    const ctx = new Context(this);
    ctx._setUri(uri);
    return ctx;
  }

  shift (router) {
    const { uri } = this;
    if (!uri.startsWith(router.root)) {
      throw new Error(`Context not eligible for ${router.nodeName} with root:${router.root}`);
    }

    return this.withUri(router.root === '/' ? uri : uri.substr(router.root.length));
  }

  /**
   * Copy context for specific route
   * @param {Route} route
   */
  for (route) {
    const ctx = new Context(this);
    ctx.parameters = {
      ...this.parameters,
      ...route.fetchSegmentParameters(this.pathname),
    };
    return ctx;
  }
}

function parse (search) {
  return search.split('&').map(token => {
    const [ key, value ] = token.split('=');
    return { key, value };
  });
}
