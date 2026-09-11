const { handleRequest } = require('../.test-build/index');
const { resolveGoogle } = require('../.test-build/src/coordinates');
const { getCid, parseEmbed } = require('../.test-build/src/google');
const { record } = require('./fixtures/matterhorn.json');

const identity = '10963526813378500681';
const cidUrl = `https://maps.google.com/maps?cid=${identity}&output=embed`;
const request = (url) => new Request(`https://proxy.example/coordinates?${new URLSearchParams({ url })}`);
const embed = (value) => `<script>initEmbed(${JSON.stringify([value])});</script>`;

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
  const response = await handleRequest(request(url), async () => new Response(embed(record)));
  expect(response.status).toBe(422);
});

test.each([
  `https://www.google.com/maps/place/Matterhorn/data=!4m2!3m1!1s${record[0]}?q=1,2`,
  `https://www.google.com/maps/embed?pb=!1m3!3m2!1m1!4s${identity}&q=1,2`,
  `https://maps.google.com/maps?cid=${identity}&q=1,2`,
  `https://maps.google.com/maps?ftid=${record[0]}&q=1,2`,
])('honors identity consistently before coordinate-query fallback: %s', async (url) => {
  const fetcher = jest.fn(async () => new Response(embed(record)));
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

test.each(['Point', 'Point ]); North', 'Point " ]); \\ North', '[] [nested] \\" ]); 山'])(
  'extracts balanced embed JSON without interpreting label text: %s',
  (name) => {
    const value = [record[0], name, record[2]];
    expect(parseEmbed(new URL(cidUrl), embed(value))).toEqual({
      latitude: record[2][0],
      longitude: record[2][1],
      name,
      resolution: 'cid',
    });
  }
);

test('rejects an unterminated embed array instead of accepting a partial record', () => {
  const html = `<script>initEmbed([${JSON.stringify(record)});</script>`;
  expect(() => parseEmbed(new URL(cidUrl), html)).toThrow('Unrecognized');
});

test('keeps the legacy labelled grammar in query values only', async () => {
  expect(await resolveGoogle('https://maps.google.com/maps?q=Trailhead%401,2', jest.fn())).toEqual({
    latitude: 1,
    longitude: 2,
    name: 'Trailhead',
    resolution: 'query',
  });
});
