const { URL } = window;

export class Context {
  constructor ({ uri, state, originalUri = uri, pathname, search, query, parameters }) {
    this.originalUri = originalUri;
    this.uri = uri;

    if (pathname === undefined) {
      const url = new URL(uri, 'http://localhost');
      pathname = url.pathname;
      if (url.search[0] === '?') {
        search = url.search.substr(1);
      }
      query = parse(search);
    }

    this.pathname = pathname;
    this.search = search;
    this.query = query;

    this.parameters = { ...parameters };
    this.state = { ...state };
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
  if (!search) {
    return {};
  }

  const query = {};

  search.split('&').forEach(token => {
    const [key, value] = token.split('=');
    query[key] = value;
  });

  return query;
}
