# litx-router

Custom element for front end router

## Installation

```sh
npm i litx-router
```

## Usage

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
  <x-router listen>
    <template path="/" template="x-home"></template>
    <template path="/login" template="x-login"></template>
  </x-router>

  <script type="module">
    import { router } from 'litx-router';

    class XRouter extends router()(HTMLElement) {}
    customElements.define('x-router', XRouter);
  </script>
</body>
</html>
```
