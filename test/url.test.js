const { handleRequest } = require('../.test-build/index');
const { resolveGoogle } = require('../.test-build/src/coordinates');
const { getCid } = require('../.test-build/src/google');
const { record } = require('./fixtures/matterhorn.json');
const { noFetch, request, embed, identity } = require('./helpers');
const fixture = require('./fixtures/matterhorn.json');

const textRoutes = [
  '/maps/%70lace',
  '/%6daps/place',
  '/maps/search',
  '/maps/preview/place',
  '/maps/preview/search',
  '/maps/%70review/%70lace',
];

test.each(textRoutes)('does not interpret text in %s as markers or identity', async (route) => {
  const url = `https://www.google.com${route}/data=!3d1!4d2/@47.3,8.5,16z`;
  expect((await handleRequest(request(url), async () => new Response('no exact place'))).status).toBe(422);
  expect(getCid(new URL(`https://www.google.com${route}/data=!1s${record[0]}/@47.3,8.5,16z`))).toBeNull();
});

test.each(textRoutes)('parses real markers after the text slot in %s', async (route) => {
  const url = `https://www.google.com${route}/data=!3d1!4d2/@47.3,8.5,16z/data=!3d3!4d4`;
  expect(await resolveGoogle(url, noFetch)).toEqual({
    latitude: 3,
    longitude: 4,
    name: route.endsWith('search') ? null : 'data=!3d1!4d2',
    resolution: 'marker',
  });
});

test('does not interpret data in an unknown route shape', async () => {
  const url = 'https://www.google.com/maps/unknown/data=!3d1!4d2';
  expect((await handleRequest(request(url), async () => new Response('no exact place'))).status).toBe(422);
});

test.each(['', '&q=1,2'])('resolves a hexadecimal embed identity before query fallback: %s', async (query) => {
  const url = `https://www.google.com/maps/embed?pb=!1m4!3m3!1m2!1s${record[0]}!2sMatterhorn${query}`;
  const fetcher = jest.fn(async () => new Response(embed([record])));
  expect(getCid(new URL(url))).toBe(identity);
  expect(await resolveGoogle(url, fetcher)).toEqual({
    latitude: record[2][0],
    longitude: record[2][1],
    name: record[1],
    resolution: 'cid',
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test.each(['!1sunsupported-place', '!1s0x1:0xZZ'])(
  'does not replace an unrecognized embed identity with a coordinate query: %s',
  async (pb) => {
    const url = `https://www.google.com/maps/embed?${new URLSearchParams({ pb, q: '1,2' })}`;
    expect((await handleRequest(request(url), async () => new Response(embed([record])))).status).toBe(422);
  }
);

test.each([
  ['+', null],
  ['%20%09%20', null],
  ['', null],
  ['+%20Trailhead%20+', 'Trailhead'],
])('normalizes blank and padded place names: %s', async (slug, name) => {
  const url = `https://www.google.com/maps/place/${slug}/data=!3d1!4d2`;
  const response = await handleRequest(request(url), noFetch);
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json.name).toBe(name);
  expect(json.url.geo).toBe(name ? 'geo:1,2?q=1,2(Trailhead)' : 'geo:1,2');
});

test.each([
  ['40.706305,19.9521', 40.706305, 19.9521, null],
  ['0,0', 0, 0, null],
  ['-90,+180', -90, 180, null],
  ['Trailhead@1.3067198,103.83282', 1.3067198, 103.83282, 'Trailhead'],
  ['Point @ 180@1.356706,103.87591', 1.356706, 103.87591, 'Point @ 180'],
  ['100%25 point@1,2', 1, 2, '100%25 point'],
])('resolves coordinate query offline: %s', async (q, latitude, longitude, name) => {
  const response = await handleRequest(request(`https://maps.google.com/?${new URLSearchParams({ q })}`), noFetch);
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json.coordinates).toEqual({ latitude, longitude });
  expect(json.name).toBe(name);
  const latLon = `${latitude},${longitude}`;
  expect(json.url.geo).toBe(`geo:${latLon}${name ? `?q=${latLon}(${encodeURIComponent(name)})` : ''}`);
  expect(response.headers.get('cache-control')).toBe('no-store');
});

test.each(['123,45', '40.1,1181', `40°60'00"N 19°56'09.9"E`, `40°42'60"N 19°56'09.9"E`])('rejects invalid coordinates: %s', async (q) => {
  const response = await handleRequest(request(`https://maps.google.com/?${new URLSearchParams({ q })}`), noFetch);
  expect(response.status).toBe(422);
});

test('parses DMS with valid minute/second components', async () => {
  const q = `40°42'22.7"N 19°56'09.9"E`;
  const point = await resolveGoogle(`https://maps.google.com/?${new URLSearchParams({ q })}`, noFetch);
  expect(point.latitude).toBeCloseTo(40.706305555555555, 10);
  expect(point.longitude).toBeCloseTo(19.936083333333334, 10);
});

test('takes venue marker rather than viewport using a synthetic shared point', async () => {
  const url =
    'https://www.google.com/maps/place/Shared+point/@47.3702136,8.5394238,16z/data=!4m6!3m5!1s0x1:0x2!8m2!3d47.371461!4d8.543614!16s%2Fg%2F1tdm78zc';
  expect(await resolveGoogle(url, noFetch)).toEqual({
    latitude: 47.371461,
    longitude: 8.543614,
    name: 'Shared point',
    resolution: 'marker',
  });
});

test.each([
  'https://www.google.com/maps/place/Foo/@40.7,19.9,15z',
  'https://maps.google.com/?ll=40.7,19.9',
  'https://maps.google.com/?center=40.7,19.9',
  'https://maps.google.com/?q=Summit&query_place_id=ChIJ-test',
])('does not replace an unresolved place with a camera center or search: %s', async (url) => {
  const response = await handleRequest(request(url), async () => new Response('<html></html>'));
  expect(response.status).toBe(422);
  expect((await response.json()).coordinates).toBeUndefined();
});

test.each([
  'http://maps.google.com/?q=1,2',
  'https://google.com.example/maps?q=1,2',
  'https://example.com/?q=1,2',
  'https://user:password@maps.google.com/?q=1,2',
  'https://maps.google.com:8443/?q=1,2',
  'https://www.google.com/url?q=1,2',
  'https://goo.gl/unrelated',
])('rejects unsupported input without network: %s', async (url) => {
  const fetcher = jest.fn(noFetch);
  expect((await handleRequest(request(url), fetcher)).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

test.each(['https://www.google.com/maps/dir/A/B/data=!3d1!4d2', 'https://maps.google.com/?q=1,2&destination=3,4'])(
  'rejects routes instead of choosing one point: %s',
  async (url) => {
    expect((await handleRequest(request(url), noFetch)).status).toBe(422);
  }
);

test('rejects encoded directions paths before parsing their markers', async () => {
  expect((await handleRequest(request('https://www.google.com/maps/%64ir/A/B/data=!3d1!4d2'), noFetch)).status).toBe(422);
});

test('converts a 64-bit ftid without Number precision loss', async () => {
  const fetcher = jest.fn(async () => new Response(embed([fixture.record])));
  const point = await resolveGoogle(`https://maps.google.com/?q=1,2&ftid=${fixture.record[0]}`, fetcher);
  expect(point.resolution).toBe('cid');
  expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('cid')).toBe('10963526813378500681');
});

test('returns useful HTTP errors and keeps /redirect working', async () => {
  expect((await handleRequest(new Request('https://proxy.example/coordinates'), noFetch)).status).toBe(400);
  expect((await handleRequest(new Request('https://proxy.example/coordinates', { method: 'POST' }), noFetch)).status).toBe(405);
  const response = await handleRequest(request('https://maps.google.com/?q=1,2', '/redirect'), noFetch);
  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toBe('geo:1,2');
});

test.each([
  ['A%2FB+Trail', 'A/B Trail'],
  ['C%2B%2B+Point', 'C++ Point'],
  ['Caf%C3%A9+%28North%29', 'Café (North)'],
  ['100%2525+Point', '100%25 Point'],
])('decodes a place segment once, after splitting: %s', async (slug, name) => {
  const point = await resolveGoogle(`https://www.google.com/maps/place/${slug}/@1,2,15z/data=!8m2!3d3!4d4`, noFetch);
  expect(point.name).toBe(name);
  expect([point.latitude, point.longitude]).toEqual([3, 4]);
});

test.each(['www.google.de', 'maps.google.co.uk', 'www.google.fr', 'maps.google.com.br', 'google.co.jp', 'www.google.cat'])(
  'supports published international Google domains: %s',
  async (host) => {
    const point = await resolveGoogle(`https://${host}/maps?q=1,2`, noFetch);
    expect([point.latitude, point.longitude]).toEqual([1, 2]);
  }
);

test.each(['google.zz', 'google.com.cm', 'maps.google.co.fr', 'www.maps.google.de', 'google.de.example', 'google.com.evil'])(
  'rejects unlisted Google-shaped hosts before fetching: %s',
  async (host) => {
    const fetcher = jest.fn(noFetch);
    expect((await handleRequest(request(`https://${host}/maps?q=1,2`), fetcher)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  }
);

test('rejects malformed place encoding before the parser or network', async () => {
  const fetcher = jest.fn(noFetch);
  const response = await handleRequest(request('https://www.google.com/maps/place/%ZZ/data=!3d1!4d2'), fetcher);
  expect(response.status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

test.each(['Shared point', 'A/B & C++ (North) #1?=2', 'Café 山 100%25'])(
  'preserves and escapes labels in geo redirects: %s',
  async (name) => {
    const url = `https://maps.google.com/?${new URLSearchParams({ q: `${name}@1,2` })}`;
    const response = await handleRequest(request(url, '/redirect'), noFetch);
    const encoded = encodeURIComponent(name).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    expect(response.headers.get('location')).toBe(`geo:1,2?q=1,2(${encoded})`);
  }
);

test.each(['Point !3d1!4d2', 'Point /data=!3d1!4d2', 'data=!3d1!4d2'])(
  'does not interpret marker-looking place names as data: %s',
  async (name) => {
    const url = `https://www.google.com/maps/place/${encodeURIComponent(name).replace(/!/g, '%21')}/@47.3,8.5,16z`;
    const response = await handleRequest(request(url), async () => new Response('no exact place'));
    expect(response.status).toBe(422);
    expect((await response.json()).coordinates).toBeUndefined();
  }
);

test.each(['Point !3d1!4d2', 'Point /data=!3d1!4d2', 'data=!3d1!4d2'])(
  'a real data marker is independent of the name: %s',
  async (name) => {
    const url = `https://www.google.com/maps/place/${encodeURIComponent(name).replace(/!/g, '%21')}/@1,2,16z/data=!8m2!3d47.37!4d8.54`;
    const fetcher = jest.fn();
    expect(await resolveGoogle(url, fetcher)).toEqual({ latitude: 47.37, longitude: 8.54, name, resolution: 'marker' });
    expect(fetcher).not.toHaveBeenCalled();
  }
);

test('does not treat a literal data= place name as a structural component', async () => {
  const url = 'https://www.google.com/maps/place/data=!3d1!4d2/@47.3,8.5,16z';
  expect((await handleRequest(request(url), async () => new Response('no exact place'))).status).toBe(422);
});

test.each([`Point !1s${record[0]}`, `Point /data=!1s${record[0]}`])('does not derive a CID from a place name: %s', async (name) => {
  const url = `https://www.google.com/maps/place/${encodeURIComponent(name).replace(/!/g, '%21')}/@47.3,8.5,16z`;
  expect(getCid(new URL(url))).toBeNull();
  const response = await handleRequest(request(url), async () => new Response(embed([record])));
  expect(response.status).toBe(422);
});

test.each([
  `https://www.google.com/maps/place/Matterhorn/data=!4m2!3m1!1s${record[0]}?q=1,2`,
  `https://www.google.com/maps/embed?pb=!1m3!3m2!1m1!4s${identity}&q=1,2`,
  `https://maps.google.com/maps?cid=${identity}&q=1,2`,
  `https://maps.google.com/maps?ftid=${record[0]}&q=1,2`,
])('honors identity consistently before coordinate-query fallback: %s', async (url) => {
  const fetcher = jest.fn(async () => new Response(embed([record])));
  const point = await resolveGoogle(url, fetcher);
  expect([point.latitude, point.longitude, point.name, point.resolution]).toEqual([record[2][0], record[2][1], record[1], 'cid']);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test.each(['!3dlabel@1!4d2', '!3d1!4d2@3,4', '!3d!4d2', '!3d1!4d', '!3d91!4d2', '!3d1!4d181'])(
  'rejects malformed or out-of-range numeric marker fields: %s',
  async (data) => {
    const fetcher = jest.fn();
    const response = await handleRequest(request(`https://www.google.com/maps/place/Point/data=!8m2${data}`), fetcher);
    expect(response.status).toBe(422);
    expect(fetcher).not.toHaveBeenCalled();
  }
);

test('retains signed numeric markers in a percent-encoded data payload', async () => {
  const data = encodeURIComponent('!8m2!3d-1.25!4d+2.5').replace(/!/g, '%21');
  expect(await resolveGoogle(`https://www.google.com/maps/@40,50,15z/data=${data}`, jest.fn())).toEqual({
    latitude: -1.25,
    longitude: 2.5,
    name: null,
    resolution: 'marker',
  });
});

test('keeps the legacy labelled grammar in query values only', async () => {
  expect(await resolveGoogle('https://maps.google.com/maps?q=Trailhead%401,2', jest.fn())).toEqual({
    latitude: 1,
    longitude: 2,
    name: 'Trailhead',
    resolution: 'query',
  });
});
