const { handleRequest } = require('../.test-build/index');
const { resolveGoogle } = require('../.test-build/src/coordinates');

const noFetch = () => {
  throw new Error('Unexpected network request');
};
const request = (url, path = '/coordinates') => new Request(`https://proxy.example${path}?${new URLSearchParams({ url })}`);
const redirect = (location, headers = {}) => new Response(null, { status: 302, headers: { Location: location, ...headers } });

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

test('strips tracking from a legacy short link reached through a redirect', async () => {
  const fetcher = jest
    .fn()
    .mockImplementationOnce(async () => redirect('https://goo.gl/maps/second?g_st=ic&utm_source=example#fragment'))
    .mockImplementationOnce(async () => redirect('https://maps.google.com/?q=1,2'));
  await resolveGoogle('https://maps.app.goo.gl/first?g_st=ic', fetcher);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['https://maps.app.goo.gl/first', 'https://goo.gl/maps/second']);
});

test.each([404, 410])('an unavailable upstream link fails once as an unresolvable place: %s', async (status) => {
  const fetcher = jest.fn(async () => new Response('', { status }));
  const response = await handleRequest(request('https://maps.app.goo.gl/missing'), fetcher);
  expect(response.status).toBe(422);
  expect((await response.json()).error).toBe('This Google Maps link is no longer available.');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('rejects malformed place encoding before the parser or network', async () => {
  const fetcher = jest.fn(noFetch);
  const response = await handleRequest(request('https://www.google.com/maps/place/%ZZ/data=!3d1!4d2'), fetcher);
  expect(response.status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

test('does not replay server cookies even between hops on the same origin', async () => {
  const fetcher = jest
    .fn()
    .mockImplementationOnce(async () => redirect('https://maps.app.goo.gl/second', { 'Set-Cookie': 'session=example' }))
    .mockImplementationOnce(async () => redirect('https://maps.google.com/?q=1,2'));
  await resolveGoogle('https://maps.app.goo.gl/first', fetcher);
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const [, options] of fetcher.mock.calls) expect(new Headers(options.headers).has('Cookie')).toBe(false);
});

test('cancels an identity-free HTML body without reading it', async () => {
  const upstream = new Response('unused HTML');
  const read = jest.spyOn(upstream.body, 'getReader');
  const cancel = jest.spyOn(upstream.body, 'cancel');
  const response = await handleRequest(request('https://maps.google.com/maps?q=Summit'), async () => upstream);
  expect(response.status).toBe(422);
  expect((await response.json()).error).toBe('Could not resolve an exact place from this Google Maps link.');
  expect(read).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledTimes(1);
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
