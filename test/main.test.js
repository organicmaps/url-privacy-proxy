const { handleRequest } = require('../.test-build/index');
const { resolveGoogle } = require('../.test-build/src/coordinates');
const { parseEmbed } = require('../.test-build/src/google');
const fixture = require('./fixtures/matterhorn.json');
const montBlanc = require('./fixtures/mont-blanc.json');

const noFetch = () => {
  throw new Error('Unexpected network request');
};
const request = (url, path = '/coordinates') => new Request(`https://proxy.example${path}?${new URLSearchParams({ url })}`);
const redirect = (location, headers = {}) => new Response(null, { status: 302, headers: { Location: location, ...headers } });
const embed = (records) => `<script>initEmbed(${JSON.stringify(records)});</script>`;
const cidUrl = 'https://maps.google.com/maps?cid=10963526813378500681&output=embed';

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
  expect(json.url.geo).toBe(`geo:${latitude},${longitude}`);
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
  expect(await resolveGoogle(url, noFetch)).toEqual({ latitude: 47.371461, longitude: 8.543614, name: 'Shared point', source: 'marker' });
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

test('stops at the intermediate bare-pin redirect and removes tracking', async () => {
  const fetcher = jest.fn(async () => redirect('https://maps.google.com/?q=40.706305,19.9521'));
  const point = await resolveGoogle('https://maps.app.goo.gl/example?g_st=bad#fragment', fetcher);
  expect(point.latitude).toBe(40.706305);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe('https://maps.app.goo.gl/example');
  expect(fetcher.mock.calls[0][1].redirect).toBe('manual');
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

test('validates redirects before parsing their coordinates', async () => {
  const fetcher = jest.fn(async () => redirect('https://example.com/?q=1,2'));
  expect((await handleRequest(request('https://maps.app.goo.gl/example'), fetcher)).status).toBe(400);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('validates nested consent destinations', async () => {
  const url = 'https://consent.google.com/m?' + new URLSearchParams({ continue: 'https://example.com/?q=1,2' });
  expect((await handleRequest(request(url), noFetch)).status).toBe(400);
});

test.each(['https://www.google.com/maps/dir/A/B/data=!3d1!4d2', 'https://maps.google.com/?q=1,2&destination=3,4'])(
  'rejects routes instead of choosing one point: %s',
  async (url) => {
    expect((await handleRequest(request(url), noFetch)).status).toBe(422);
  }
);

test('extracts a structurally identified record from the captured Matterhorn response', () => {
  expect(parseEmbed(new URL(cidUrl), embed([[null, fixture.record]]))).toEqual({
    latitude: 45.9765738,
    longitude: 7.658451899999999,
    name: fixture.record[1],
    source: 'cid',
  });
});

test('extracts the independently captured Mont Blanc record', () => {
  const identity = BigInt(montBlanc.record[0].split(':')[1]).toString();
  expect(parseEmbed(new URL(`https://maps.google.com/maps?cid=${identity}`), embed([montBlanc.record]))).toEqual({
    latitude: 45.8326223,
    longitude: 6.8651749,
    name: montBlanc.record[1],
    source: 'cid',
  });
});

test('supports the optional decimal CID field only when it agrees', () => {
  expect(parseEmbed(new URL(cidUrl), embed([[...fixture.record, '10963526813378500681']]))?.source).toBe('cid');
  expect(parseEmbed(new URL(cidUrl), embed([[...fixture.record, '123']]))).toBeNull();
});

test('follows the captured embed redirect with origin=mfe', async () => {
  const fetcher = jest
    .fn()
    .mockImplementationOnce(async () => redirect('https://www.google.com/maps/embed?origin=mfe&pb=!1m3!3m2!1m1!4s10963526813378500681'))
    .mockImplementationOnce(async () => new Response(embed([fixture.record])));
  expect((await resolveGoogle(cidUrl, fetcher)).latitude).toBe(45.9765738);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('rejects encoded directions paths before parsing their markers', async () => {
  expect((await handleRequest(request('https://www.google.com/maps/%64ir/A/B/data=!3d1!4d2'), noFetch)).status).toBe(422);
});

test('bounds requests that do not return headers', async () => {
  jest.useFakeTimers();
  try {
    const fetcher = jest.fn(
      (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
    );
    const result = handleRequest(request(cidUrl), fetcher);
    await jest.advanceTimersByTimeAsync(30_000);
    expect((await result).status).toBe(504);
    expect(fetcher).toHaveBeenCalledTimes(3);
  } finally {
    jest.useRealTimers();
  }
});

test('ignores nearby coordinates, unrelated records and CID occurrences', () => {
  const records = [[[1, 2], '10963526813378500681'], [fixture.record[0], 'Different place', [3, 4], '999'], fixture.record];
  expect(parseEmbed(new URL(cidUrl), embed(records)).latitude).toBe(45.9765738);
  expect(parseEmbed(new URL(cidUrl), embed(records.slice(0, 2)))).toBeNull();
});

test('requires matching hexadecimal and decimal IDs', () => {
  expect(parseEmbed(new URL(cidUrl), embed([['0x1:0x2', 'Wrong', [1, 2], '10963526813378500681']]))).toBeNull();
});

test('rejects conflicting records for one place', () => {
  expect(() => parseEmbed(new URL(cidUrl), embed([fixture.record, [fixture.record[0], 'Wrong', [1, 2], '10963526813378500681']]))).toThrow(
    'Conflicting'
  );
});

test('does not evaluate JavaScript in an embed response', () => {
  global.executed = false;
  expect(() => parseEmbed(new URL(cidUrl), '<script>initEmbed([global.executed = true]);</script>')).toThrow('Unrecognized');
  expect(global.executed).toBe(false);
});

test('converts a 64-bit ftid without Number precision loss', async () => {
  const fetcher = jest.fn(async () => new Response(embed([fixture.record])));
  const point = await resolveGoogle(`https://maps.google.com/?q=1,2&ftid=${fixture.record[0]}`, fetcher);
  expect(point.source).toBe('cid');
  expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('cid')).toBe('10963526813378500681');
});

test('requests do not reuse previous coordinates or state', async () => {
  const good = await handleRequest(request(cidUrl), async () => new Response(embed([fixture.record])));
  const bad = await handleRequest(request(cidUrl), async () => new Response('no coordinates'));
  expect(good.status).toBe(200);
  expect(bad.status).toBe(422);
  expect((await bad.json()).url).toBeUndefined();
});

test('concurrent conversions keep their results separate', async () => {
  const links = ['https://maps.app.goo.gl/first', 'https://maps.app.goo.gl/second'];
  const fetcher = async (url) => {
    await new Promise((resolve) => setTimeout(resolve, url.endsWith('first') ? 15 : 1));
    return redirect(`https://maps.google.com/?q=${url.endsWith('first') ? '1,2' : '3,4'}`);
  };
  const points = await Promise.all(links.map((link) => resolveGoogle(link, fetcher)));
  expect(points.map((point) => point.latitude)).toEqual([1, 3]);
});

test('retries transient errors but not permanent failures', async () => {
  const retry = jest
    .fn()
    .mockImplementationOnce(async () => new Response('', { status: 404 }))
    .mockImplementationOnce(async () => redirect('https://maps.google.com/?q=1,2'));
  expect((await resolveGoogle('https://maps.app.goo.gl/example', retry)).latitude).toBe(1);
  expect(retry).toHaveBeenCalledTimes(2);
  const permanent = jest.fn(async () => new Response('', { status: 403 }));
  expect((await handleRequest(request('https://maps.app.goo.gl/example'), permanent)).status).toBe(502);
  expect(permanent).toHaveBeenCalledTimes(1);
});

test('does not forward client headers or server cookies to other origins', async () => {
  const fetcher = jest
    .fn()
    .mockImplementationOnce(async () =>
      redirect('https://maps.google.com/maps?cid=10963526813378500681&output=embed', { 'Set-Cookie': 'session=private' })
    )
    .mockImplementationOnce(async () => new Response(embed([fixture.record])));
  const req = new Request(request('https://maps.app.goo.gl/example'), {
    headers: { Cookie: 'user=private', Authorization: 'secret', 'X-Forwarded-For': '192.0.2.1' },
  });
  expect((await handleRequest(req, fetcher)).status).toBe(200);
  for (const [, options] of fetcher.mock.calls) {
    const headers = new Headers(options.headers);
    for (const name of ['Cookie', 'Authorization', 'X-Forwarded-For']) expect(headers.has(name)).toBe(false);
  }
});

test('rejects oversized bodies rather than accepting partial results', async () => {
  const response = await handleRequest(request(cidUrl), async () => new Response(embed([fixture.record]) + ' '.repeat(3_000_001)));
  expect(response.status).toBe(502);
});

test('bounds redirect loops and handles redirects without Location', async () => {
  expect(
    (await handleRequest(request('https://maps.app.goo.gl/example'), async () => redirect('https://maps.app.goo.gl/example'))).status
  ).toBe(502);
  expect((await handleRequest(request('https://maps.app.goo.gl/example'), async () => new Response(null, { status: 302 }))).status).toBe(
    502
  );
});

test('returns useful HTTP errors and keeps /redirect working', async () => {
  expect((await handleRequest(new Request('https://proxy.example/coordinates'), noFetch)).status).toBe(400);
  expect((await handleRequest(new Request('https://proxy.example/coordinates', { method: 'POST' }), noFetch)).status).toBe(405);
  const response = await handleRequest(request('https://maps.google.com/?q=1,2', '/redirect'), noFetch);
  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toBe('geo:1,2');
});
