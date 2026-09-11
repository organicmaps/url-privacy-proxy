// Opt-in: unlike npm test, this contacts Google. No account or API key is used.
const assert = require('node:assert/strict');
const { resolveGoogle } = require('../.test-build/src/coordinates');

(async () => {
  for (const name of ['matterhorn', 'mont-blanc']) {
    const { record } = require(`./fixtures/${name}.json`);
    const identity = BigInt(record[0].split(':')[1]).toString();
    const pb = `!1m4!3m3!1m2!1s${record[0]}!2s${record[1]}`;
    for (const params of [{ cid: identity, output: 'embed' }, { ftid: record[0] }, { pb }, { pb, q: '1,2' }]) {
      const path = params.pb ? '/maps/embed' : '/maps';
      const result = await resolveGoogle(`https://maps.google.com${path}?${new URLSearchParams(params)}`);
      assert.equal(result.latitude, record[2][0]);
      assert.equal(result.longitude, record[2][1]);
      assert.equal(result.name, record[1]);
      console.log(`${name} (${params.q ? 'pb with query fallback' : Object.keys(params)[0]}): passed`);
    }
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
