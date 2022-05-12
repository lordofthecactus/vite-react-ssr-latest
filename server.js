const fs = require('fs');
const path = require('path');
const express = require('express');
const { createServer: createViteServer } = require('vite');
const { JS_BUNDLE_DELAY } = require('./delays');

async function createServer() {
  const app = express();

  // Create Vite server in middleware mode. This disables Vite's own HTML
  // serving logic and let the parent server take control.
  //
  // In middleware mode, if you want to use Vite's own HTML serving logic
  // use `'html'` as the `middlewareMode` (ref https://vitejs.dev/config/#server-middlewaremode)
  const vite = await createViteServer({
    server: { middlewareMode: 'ssr' },
  });
  // use vite's connect instance as middleware
  app.use(vite.middlewares);

  app.use((req, res, next) => {
    if (req.url.endsWith('.js')) {
      // Artificially delay serving JS
      // to demonstrate streaming HTML.
      setTimeout(next, JS_BUNDLE_DELAY);
    } else {
      next();
    }
  });

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;

    try {
      // 1. Read index.html
      let template = fs.readFileSync(
        path.resolve(__dirname, 'index.html'),
        'utf-8'
      );

      // 2. Apply Vite HTML transforms. This injects the Vite HMR client, and
      //    also applies HTML transforms from Vite plugins, e.g. global preambles
      //    from @vitejs/plugin-react
      template = await vite.transformIndexHtml(url, template);

      // 3. Load the server entry. vite.ssrLoadModule automatically transforms
      //    your ESM source code to be usable in Node.js! There is no bundling
      //    required, and provides efficient invalidation similar to HMR.
      const { render } = await vite.ssrLoadModule('/src/entry-server.jsx');

      /**
       * Scrape out `head` contents injected by Vite. This is used for React runtime and fast refresh.
       * It will be injected into the `<Html>` React component shell in the server entrypoint.
       */
      const head = template.match(/<head>(.+?)<\/head>/s)[1];

      // 4. render the app HTML. This assumes entry-server.js's exported `render`
      //    function calls appropriate framework SSR APIs,
      //    e.g. ReactDOMServer.renderToString()
      render(url, res, head);
    } catch (e) {
      // If an error is caught, let Vite fix the stracktrace so it maps back to
      // your actual source code.
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  app.listen(3000);
}

createServer();
