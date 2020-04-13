import { fixture, html, assert } from '@open-wc/testing';

describe('Router', () => {
  describe('#getUri()', () => {
    it('get uri from URL', async () => {
      {
        const router = await fixture(html`
          <litx-router mode="history"></litx-router>
        `);

        assert.strictEqual(router.getUri(new window.URL('/foo/bar', location)), '/foo/bar');
        assert.strictEqual(router.getUri(new window.URL('/foo?bar=baz', location)), '/foo?bar=baz');
      }

      {
        const router = await fixture(html`
          <litx-router></litx-router>
        `);

        assert.strictEqual(router.getUri(new window.URL('#!/foo/bar', location)), '/foo/bar');
        assert.strictEqual(router.getUri(new window.URL('#!/foo?bar=baz', location)), '/foo?bar=baz');
      }
    });
  });
});
