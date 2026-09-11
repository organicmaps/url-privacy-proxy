// Opt-in: unlike npm test, this contacts Google. No account or API key is used.
const assert = require('node:assert/strict');
const { resolveGoogle } = require('../.test-build/src/coordinates');

(async () => {
  for (const name of ['matterhorn', 'mont-blanc']) {
    const { record } = require(`./fixtures/${name}.json`);
    const identity = BigInt(record[0].split(':')[1]).toString();
    for (const params of [{ cid: identity, output: 'embed' }, { ftid: record[0] }]) {
      const result = await resolveGoogle(`https://maps.google.com/maps?${new URLSearchParams(params)}`);
      assert.equal(result.latitude, record[2][0]);
      assert.equal(result.longitude, record[2][1]);
      assert.equal(result.name, record[1]);
      console.log(`${name} (${Object.keys(params)[0]}): passed`);
    }
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
