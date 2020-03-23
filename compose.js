export function compose (middlewares) {
  middlewares = middlewares.map(fn => {
    if (typeof fn !== 'function') {
      throw new TypeError('Middleware must be composed of functions!');
    }

    return fn;
  });

  return (context, next) => {
    // last called middlewares #
    let index = -1;

    function dispatch (i) {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }

      index = i;
      let fn = middlewares[i];
      if (i === middlewares.length) {
        fn = next;
      }

      // if (!fn) {
      //   return;
      // }

      return fn(context, () => dispatch(i + 1));
    }

    return dispatch(0);
  };
}
