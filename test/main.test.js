const axios = require('axios');
// Add the test down with once checking URL through the proxy and its result and cross checking that it displays the correct coordinates.
test.each([
  ['https://maps.app.goo.gl/ZLcuEvpc2zLow752A?g_st=ic', 'geo:47.3842845,8.5744797'],
  ['https://maps.app.goo.gl/QPhWppAvmRaZnPSTA?g_st=ic', 'geo:28.3859711,79.4327414'],
  ['https://goo.gl/maps/DGMfrX4rZqeWCtv89?coh=178572&entry=tt', 'geo:47.371461,8.543614'],
  ['https://goo.gl/maps/Suj2A4m4BVkRR69S8', 'geo:28.3904755,79.4357971'],
  ['https://goo.gl/maps/sXnse1erRvkA6aV99', 'geo:33.8904447,35.5066505'],
  ['https://maps.app.goo.gl/JCoheE7WbWbAxSkY8?g_st=ic', 'geo:28.3924399,79.4315209'],
  ['https://goo.gl/maps/L2VaCu56rYSMgRVEA', 'geo:28.3840209,79.4323196'],
  ['https://maps.app.goo.gl/9ivZQ71CKMqRPDtQA', 'geo:41.0102214,28.9739212'],
  ['https://goo.gl/maps/3qq8ft64MRUWxjxG6', 'geo:40.648425,-100.822401'],
  ['https://goo.gl/maps/Dyck9mYMKEoVzhJ18', 'geo:28.385307,79.438022'],
])('returns expected JSON response for URL %s', async (inputUrl, expectedGeoUrl) => {
  const response = await axios.get(`http://127.0.0.1:8787/coordinates?url=${inputUrl}`);
  console.log(inputUrl);
  expect(response.status).toBe(200);
  const jsonData = response.data.url;
  expect(jsonData.geo).toEqual(expectedGeoUrl);
});
