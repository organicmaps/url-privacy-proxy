//const axios = require('axios');

const path:any = require('path');
import { Miniflare } from "miniflare";
import {beforeAll, afterAll, test} from '@jest/globals';

let mf: Miniflare;

beforeAll(() => {
  // Create a new Miniflare instance, starting a workerd server
  console.log("@@@@@@@@@@@@@ before all!")
  mf = new Miniflare({
    scriptPath: path.resolve(__dirname, "../index.ts"),
    modules: true,
  });
  console.log("@@@@@@@@@@@@ mf = ", mf);
});

afterAll(async () => {
  //console.log("@@@@@@@@@@@@ mf = ", mf);
  // Cleanup Miniflare, shutting down the workerd server
  if (mf)
    await mf.dispose();
});

test('city database has Vienna', async () => {
  // Send a request to the workerd server, the host is ignored
  const response = await mf.dispatchFetch("http://localhost:8787/");
  console.log(await response.text()); // Hello Miniflare!
});