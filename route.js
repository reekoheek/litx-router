const RouteType = {
  STATIC: 's',
  VARY: 'v',
};

export class Route {
  constructor ({ uri, view, props, marker }) {
    this.uri = uri;
    this.view = view;
    this.marker = marker;
    this.props = props;
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
    return (this.uri === '*') ||
      (this.type === 's' && this.uri === uri) ||
      (this.type === 'v' && uri.match(this.pattern));
  }

  /**
   * Enter focus
   * @param {import('./context').Context} ctx
   */
  async enter (ctx) {
    if (!this.viewElement) {
      this.viewElement = document.createElement(this.view);
      Object.assign(this.viewElement, this.props);
    }

    ctx = ctx.for(this);

    this.viewElement.ctx = ctx;
    await this.marker.parentElement.insertBefore(this.viewElement, this.marker);
    this.active = true;
  }

  async leave () {
    this.active = false;
    await this.marker.parentElement.removeChild(this.viewElement);
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
