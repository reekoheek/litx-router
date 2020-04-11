import { fixture, html, defineCE, assert } from '@open-wc/testing';
import '..';

const ce1 = defineCE(class extends HTMLElement {
  connectedCallback () {
    this.innerHTML = '1';
  }
});

const ce2 = defineCE(class extends HTMLElement {
  connectedCallback () {
    this.innerHTML = '2';
  }
});

describe('Router', () => {
  beforeEach(() => {
    location.hash = '#';
  });

  afterEach(() => {
    location.hash = '#';
  });

  describe('cases', () => {
    it('run router', async () => {
      const router = await fixture(html`
        <litx-router manual>
          <a href="/news"></a>
          <litx-route uri="/" view="${ce1}"></litx-route>
          <litx-route uri="/news" view="${ce2}"></litx-route>
        </litx-router>
      `);

      await router.start();

      router.querySelector('a').click();

      assert.strictEqual(router.ctx.uri, '/news');
    });
  });
});
