# litx-router

Vanilla declarative router webcomponent

## Installation

```sh
npm i litx-router
```

Usage

Directory structure

```
app/
  views/
    x-home.js
    x-login.js
  index.html
```

`index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LitxRouter</title>
</head>

<body>
  <litx-router id="router" manual>
    <litx-route url="/" view="x-home"></litx-route>
    <litx-route url="/login" view="x-login"></litx-route>
  </litx-router>

  <script type="module">
    import 'litx-router';

    router.loaders = [
      { test: true, load: view => import(view) },
    ];

    router.start();
  </script>
</body>
</html>
```

# API

## Properties

| | Type | Default | Description
|-|------|---------|-------------
|`loaders`|`array`|`[]`|Loader rules to import views
|`mode`|`string`|`hash`|Router mode (hash or history)
|`hash`|`string`|`'#!'`|Hash prefix (mode=hash)
|`root`|`string`|`'/'`|Root directory (mode=history)
|`manual`|`boolean`|`false`|Manual start?
|`routes`|`array`|`[]`|Route handlers
|`middlewares`|`array`|`[]`|Middlewares

## Events

| | Description
|-|-
|`router-dispatch`|Occurs when routed to new view

## Methods

### `use(middleware: function) => <void>`

Add middleware in koa-like middleware function

### `start()`

Start routing

### `stop()`

Stop routing

### `addRoute({ uri: string, view: string, marker?: Element })`

Add route

### `push(uri: string, state?: object)`

Navigate and push state to history

### `replace(uri: string, state?: object)`

Navigate and replace state of history

### `pop()`

Navigate back and pop state of history

### `go(delta: number)`

Navigate in delta moves
