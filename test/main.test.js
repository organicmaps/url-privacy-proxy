const axios = require('axios');
jest.setTimeout(60000000);
const testUrls = [
  ['https://maps.app.goo.gl/ZLcuEvpc2zLow752A?g_st=ic', 'geo:47.3842845,8.5744797'],
  ['https://maps.app.goo.gl/QPhWppAvmRaZnPSTA?g_st=ic', 'geo:28.3872652,79.4301254'],
  ['https://goo.gl/maps/DGMfrX4rZqeWCtv89?coh=178572&entry=tt', 'geo:47.371461,8.543614'],
  ['https://goo.gl/maps/Suj2A4m4BVkRR69S8', 'geo:28.390487500000006,79.435796875'],
  ['https://goo.gl/maps/sXnse1erRvkA6aV99', 'geo:33.8904447,35.5066505'],
  ['https://maps.app.goo.gl/JCoheE7WbWbAxSkY8?g_st=ic', 'geo:28.3924375,79.43151562499997'],
  ['https://goo.gl/maps/L2VaCu56rYSMgRVEA', 'geo:28.3840209,79.4323196'],
  ['https://maps.app.goo.gl/9ivZQ71CKMqRPDtQA', 'geo:41.0102214,28.9739212'],
  ['https://goo.gl/maps/3qq8ft64MRUWxjxG6', 'geo:40.648425,-100.822401'],
  ['https://goo.gl/maps/Dyck9mYMKEoVzhJ18', 'geo:28.385307,79.438022'],
  ['https://goo.gl/maps/TZjyL4yiFh5XykYR7', 'geo:28.4051028,79.448115'],
  ['https://goo.gl/maps/tKZf9gcTgyuQQ2vH6', 'geo:27.1751448,78.0421422'],
  ['https://goo.gl/maps/GqmBWG2TmzNWiJSh6', 'geo:26.792162500000014,82.19989062499997'],
];

test.each(testUrls)('returns expected JSON response for URL %s', async (inputUrl, expectedGeoUrl) => {
  const response = await axios.get(`https://url-uni.kartikay-2101ce32.workers.dev/coordinates?url=${inputUrl}`);
  console.log(inputUrl);
  const jsonData = response.data.url;
  expect(jsonData.geo).toEqual(expectedGeoUrl);
});
