const RouteType = {
  STATIC: 's',
  VARY: 'v',
};

export class Route {
  constructor ({ router, uri, view, marker }) {
    this.router = router;
    this.uri = uri;
    this.view = view;
    this.marker = marker;
    this.active = false;

    if (isStatic(uri)) {
      this.type = RouteType.STATIC;
      this.pattern = null;
      this.args = [];
    } else {
      const [pattern, args] = parseRegExp(uri);
      this.type = RouteType.VARY;
      this.pattern = pattern;
      this.args = args;
    }
  }

  fetchSegmentParameters (uri) {
    const result = uri.match(this.pattern);

    if (!result) {
      return {};
    }

    return this.args.reduce((args, name, index) => {
      args[name] = result[index + 1];
      return args;
    }, {});
  }

  test (uri) {
    return (this.type === 's' && this.uri === uri) || (this.type === 'v' && uri.match(this.pattern));
  }

  async enter (ctx) {
    if (!this.viewElement) {
      await this.router.prepare(this.view);

      this.viewElement = document.createElement(this.view);
    }

    ctx = ctx.for(this);

    this.viewElement.ctx = ctx;
    this.marker.parentElement.insertBefore(this.viewElement, this.marker);
    this.active = true;
  }

  leave () {
    this.active = false;
    this.marker.parentElement.removeChild(this.viewElement);
    delete this.viewElement;
  }
}

function parseRegExp (str) {
  const chunks = str.split('[');

  if (chunks.length > 2) {
    throw new Error('Invalid use of optional params');
  }

  const tokens = [];
  const re = chunks[0].replace(/{([^}]+)}/g, function (g, token) {
    tokens.push(token);
    return '([^/]+)';
  }).replace(/\//g, '\\/');

  let optRe = '';

  if (chunks[1]) {
    optRe = '(?:' + chunks[1].slice(0, -1).replace(/{([^}]+)}/g, function (g, token) {
      const [realToken, re = '[^/]+'] = token.split(':');
      tokens.push(realToken);
      return `(${re})`;
    }).replace(/\//g, '\\/') + ')?';
  }

  return [new RegExp('^' + re + optRe + '$'), tokens];
}

function isStatic (pattern) {
  return !pattern.match(/[[{]/);
}
