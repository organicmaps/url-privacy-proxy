const { handleRequest } = require('../.test-build/index');
const { resolveGoogle } = require('../.test-build/src/coordinates');
const fixture = require('./fixtures/matterhorn.json');
const { noFetch, request, redirect, embed, cidUrl } = require('./helpers');

test('stops at the intermediate bare-pin redirect and removes tracking', async () => {
  const fetcher = jest.fn(async () => redirect('https://maps.google.com/?q=40.706305,19.9521'));
  const point = await resolveGoogle('https://maps.app.goo.gl/example?g_st=bad#fragment', fetcher);
  expect(point.latitude).toBe(40.706305);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe('https://maps.app.goo.gl/example');
  expect(fetcher.mock.calls[0][1].redirect).toBe('manual');
});

test.each([
  'https://example.com/?q=1,2',
  'http://maps.google.com/?q=1,2',
  'https://www.google.com/sorry/index?continue=https%3A%2F%2Fmaps.google.com',
  'https://www.google.com/maps/place/%ZZ/data=!3d1!4d2',
])('distinguishes invalid input from an invalid provider redirect: %s', async (destination) => {
  expect((await handleRequest(request(destination), noFetch)).status).toBe(400);
  const fetcher = jest.fn(async () => redirect(destination));
  expect((await handleRequest(request('https://maps.app.goo.gl/example'), fetcher)).status).toBe(502);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test.each(['https://example.com/?q=1,2', 'https://www.google.com/sorry/index?continue=example'])(
  'validates nested consent destinations as provider failures: %s',
  async (destination) => {
    const url = 'https://consent.google.com/m?' + new URLSearchParams({ continue: destination });
    expect((await handleRequest(request(url), noFetch)).status).toBe(502);
    const fetcher = jest.fn(async () => redirect(url));
    expect((await handleRequest(request('https://maps.app.goo.gl/example'), fetcher)).status).toBe(502);
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
);

test('keeps unsupported directions redirects as unresolvable links', async () => {
  const fetcher = jest.fn(async () => redirect('https://www.google.com/maps/dir/A/B/data=!3d1!4d2'));
  expect((await handleRequest(request('https://maps.app.goo.gl/example'), fetcher)).status).toBe(422);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('follows the captured embed redirect with origin=mfe', async () => {
  const fetcher = jest
    .fn()
    .mockImplementationOnce(async () => redirect('https://www.google.com/maps/embed?origin=mfe&pb=!1m3!3m2!1m1!4s10963526813378500681'))
    .mockImplementationOnce(async () => new Response(embed([fixture.record])));
  expect((await resolveGoogle(cidUrl, fetcher)).latitude).toBe(45.9765738);
  expect(fetcher).toHaveBeenCalledTimes(2);
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
    .mockImplementationOnce(async () => new Response('', { status: 503 }))
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
