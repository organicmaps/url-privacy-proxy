const { parseEmbed } = require('../.test-build/src/google');
const fixture = require('./fixtures/matterhorn.json');
const { record } = fixture;
const montBlanc = require('./fixtures/mont-blanc.json');
const { embed, cidUrl } = require('./helpers');

test('extracts a structurally identified record from the captured Matterhorn response', () => {
  expect(parseEmbed(new URL(cidUrl), embed([[null, fixture.record]]))).toEqual({
    latitude: 45.9765738,
    longitude: 7.658451899999999,
    name: fixture.record[1],
    resolution: 'cid',
  });
});

test('extracts the independently captured Mont Blanc record', () => {
  const identity = BigInt(montBlanc.record[0].split(':')[1]).toString();
  expect(parseEmbed(new URL(`https://maps.google.com/maps?cid=${identity}`), embed([montBlanc.record]))).toEqual({
    latitude: 45.8326223,
    longitude: 6.8651749,
    name: montBlanc.record[1],
    resolution: 'cid',
  });
});

test('supports the optional decimal CID field only when it agrees', () => {
  expect(parseEmbed(new URL(cidUrl), embed([[...fixture.record, '10963526813378500681']]))?.resolution).toBe('cid');
  expect(parseEmbed(new URL(cidUrl), embed([[...fixture.record, '123']]))).toBeNull();
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

test.each(['Point', 'Point ]); North', 'Point " ]); \\ North', '[] [nested] \\" ]); 山'])(
  'extracts balanced embed JSON without interpreting label text: %s',
  (name) => {
    const value = [record[0], name, record[2]];
    expect(parseEmbed(new URL(cidUrl), embed([value]))).toEqual({
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
