# litx-router

Vanilla router custom element with multiple routes and middlewares.

## Installation

```sh
npm i litx-router
```

## Getting started

Simply import `litx-router` then use the custom elements in your application.
Routes and middlewares can be defined declaratively as immediate children of
the router instance as example below.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LitxRouter</title>
</head>

<body>
  <litx-router listen>
    <template route path="/" template="x-home"></template>
    <template route path="/login" template="x-login"></template>
  </litx-router>

  <script type="module" src="index.js"></script>
</body>
</html>
```

Write `index.js`:

```typescript
import 'litx-router';
```

## Router Mixin/Decorator

Use router mixin/decorator to define customized router element.

Outlet element to render can be defined with tag element with `outlet`
attribute. If no outlet defined, default outlet element will be element itself.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title></title>
</head>
<body>
  <x-router>
    <template route path="/" template="x-home"></template>
    <template route path="/login" template="x-login"></template>
  </x-router>

  <script type="module" src="index.js"></script>
</body>
</html>
```

Write `index.ts` to be compiled as `index.js`.

```typescript
import { router } from 'litx-router';

// use router decorator

@router()
export class XRouter extends HTMLElement {
  // ...
}
customElements.define('x-router', XRouter);

// or use mixin

class XRouter extends router()(HTMLElement) {
  // ...
}
customElements.define('x-router', XRouter);
```

## Router

Use class `Router` to define router programmatically in javascript.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title></title>
</head>
<body>
  <div id="outlet"></div>

  <script type="module" src="index.js"></script>
</body>
</html>
```

```typescript
import { Router } from 'litx-router';

const router = new Router(document.getElementById('outlet'))
  .use(async (ctx, next) => {
    // do something before
    await next();
    // do something after
  })
  .route(
    {
      path: '/',
      template: 'x-home',
    },
    {
      path: '/foo',
      template: 'x-foo',
    },
  );
```

## Configuration

Configure whether use push state `history` or `hash`-bang mode. Default value
is `history`.

```typescript
configure({
  mode: 'history', // or 'hash'
});
```

## Route

Route can be defined declaratively in html tag. The rules for the html tag to
use as route are:

1. Immediate child element of router
2. Has route attribute
3. Has path attribute
4. Has template attribute or has content (inner html).

Route can be defined programmatically as router mixin/decorator options.


```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title></title>
</head>
<body>
  <x-router>
    <!-- define route declaratively -->
    <template route path="/" template="x-home"></template>
    <template route path="/login" template="x-login"></template>
    <!-- define template as content of template element -->
    <template route path="/about">
      <h1> About </h1>
      <p> Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam
      nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat,
      sed diam voluptua. At vero eos et accusam et justo duo dolores et ea
      rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum
      dolor sit amet.  <p>
    </template>
  </x-router>
</body>
</html>
```

```typescript
import { router } from 'litx-router';

@router({
  // define routes programmatically as options
  routes: [
    {
      path: '/',
      template: 'x-home',
    },
  ]
})
export class XRouter extends HTMLElement {
  // ...
}
```

Route configuration must have `path` as string and `template` to render. Route
config signature:

```typescript
{
  path: string;
  template: Template;
}
```

Route path can be static path or parameterized path.

```typescript
// static path
'/'
'/foo'

// parameterized path
'/user/{id}'
'/group/{id}/member/{memberId}'
```
Route template supported are:

1. DOM Element or DocumentFragment

```typescript
{
  path: '/',
  template: document.createElement('div'),
}

// or

{
  path: '/',
  template: document.createDocumentFragment(),
}
```

2. Tag-name of element

```typescript
{
  path: '/',
  template: 'x-home',
}
```

3. Async function returning either (1) or (2). Implement lazy load with this
   kind of route template.

```typescript
{
  path: '/',
  template: async (ctx) => {
    await import('./tpl/x-home');
    return 'x-home';
  },
}
```

## Middleware

Middleware can be defined declaratively in html tag. The rules for the html tag
to use as route are:

1. Immediate child element of router
2. Has middleware attribute
3. Has callback attribute as function

Middleware can be defined programmatically as router mixin/decorator options.
Middleware are in KOA-like middlewares.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title></title>
</head>
<body>
  <litx-router>
    <m-1 middleware></m-1>
    <m-2 middleware></m-2>
  </litx-router>
</body>
</html>
```

## Context

Context has signature as follows,

```typescript
{
  path: string;
  query?: Record<string, string>;
  parameters?: Record<string, string>;
  state: unknown;
}
```

## Navigations

```typescript
async function push (path: string, state: unknown): Promise<void>;
async function replace (path: string, state: unknown): Promise<void>;
async function pop (): Promise<void>;
async function go (delta: number): Promise<void>;
```

```typescript
import { push, pop, replace, go } from 'litx-router';

(async () => {
  await push('/foo/bar', { name: 'foobar' });

  await replace('/foo/bar', { name: 'foobar' });

  await pop();

  await go(-2);
})();
```

## Other APIs

```typescript
async function reset();
async function inspect();
```
