import React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import { App } from './App';
import { DataProvider } from './data';
import { API_DELAY, ABORT_DELAY } from './delays';

let assets = {
  'entry-client.jsx': '/entry-client.jsx',
};

export function render(url, res, head) {
  console.log('entry server');
  // This is how you would wire it up previously:
  //
  // res.send(
  //   '<!DOCTYPE html>' +
  //   renderToString(
  //     <DataProvider data={data}>
  //       <App assets={assets} />
  //     </DataProvider>,
  //   )
  // );

  // The new wiring is a bit more involved.
  res.socket.on('error', (error) => {
    console.error('Fatal', error);
  });
  let didError = false;
  const data = createServerData();
  const stream = ReactDOMServer.renderToPipeableStream(
    <DataProvider data={data}>
      <App head={head} />
    </DataProvider>,
    {
      // bootstrapScripts: [assets['entry-client.jsx']],
      onShellReady() {
        // If something errored before we started streaming, we set the error code appropriately.
        res.statusCode = didError ? 500 : 200;
        res.setHeader('Content-type', 'text/html');
        stream.pipe(res);
      },
      onError(x) {
        didError = true;
        console.error(x);
      },
    }
  );
  // Abandon and switch to client rendering if enough time passes.
  // Try lowering this to see the client recover.
  setTimeout(() => stream.abort(), ABORT_DELAY);
}

// Simulate a delay caused by data fetching.
// We fake this because the streaming HTML renderer
// is not yet integrated with real data fetching strategies.
function createServerData() {
  let done = false;
  let promise = null;
  return {
    read() {
      if (done) {
        return;
      }
      if (promise) {
        throw promise;
      }
      promise = new Promise((resolve) => {
        setTimeout(() => {
          done = true;
          promise = null;
          resolve();
        }, API_DELAY);
      });
      throw promise;
    },
  };
}
