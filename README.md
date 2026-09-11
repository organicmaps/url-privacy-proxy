# URL privacy proxy

Resolve a shared Google Maps place to coordinates without forwarding the client's
IP address, cookies, authorization, or user agent to Google. Requests from the app
go to this service; Google sees the service's requests. The service operator and
hosting provider still receive the client's connection. An additional Organic
Maps proxy would be a separate deployment decision.

## API

`GET /coordinates?url=<percent-encoded Google Maps URL>` returns:

```json
{
  "source": "https://maps.google.com/maps?cid=10963526813378500681&output=embed",
  "coordinates": { "latitude": 45.9765738, "longitude": 7.658451899999999 },
  "name": "Matterhorn",
  "resolution": "cid",
  "url": {
    "geo": "geo:45.9765738,7.658451899999999",
    "openstreetmap": "https://www.openstreetmap.org/?mlat=45.9765738&mlon=7.658451899999999"
  }
}
```

The existing `source`, `coordinates`, `url.geo`, and `url.openstreetmap` fields
are retained. Coordinates are numbers. `name` (nullable) and `resolution`
(`query`, `marker`, or `cid`) are additive fields. `/redirect` returns an HTTP
302 to `url.geo`. All responses use `Cache-Control: no-store`.

Errors are JSON with an `error` message: 400 for invalid/missing URLs, 422 when
an exact place cannot be resolved, 502 for provider/protocol failures, and 504
for timeouts. No previous request's coordinates are returned after failure.

The caller must percent-encode the entire nested URL, including its `&` signs.
For example, construct the query using `new URLSearchParams({ url: sharedUrl })`.

## Supported cases and accuracy

- Decimal/DMS coordinate queries, including legacy `Name@lat,lon` labels.
- Explicit `!3dLAT!4dLON` markers in Google place URLs.
- `maps.app.goo.gl` and `goo.gl/maps/` redirects. Every intermediate URL is
  inspected; resolving a coordinate query does not require another request.
- Decimal CIDs and hexadecimal `ftid` identities, resolved through Google embed
  data. Hexadecimal IDs use `BigInt`, preserving all 64 bits.
- The explicit Google host allowlist includes `.com`, `.al`, and `.ge`. Further
  regional hosts need an intentional addition and a test.

A viewport (`/@lat,lon,zoom`, `ll`, or `center`) is not an exact place. The
coordinates endpoint returns an error for unresolved viewport-only links,
text searches, shortened Plus Codes without resolvable identity, and standalone
`query_place_id` links that do not yield an explicit marker. Directions and
multiple-marker links are rejected. These are deliberate limits, not a claim
that every Google Maps URL is supported. The service does not geocode a name
and silently substitute a possibly different place.

Google embed parsing uses `JSON.parse`, never script evaluation. The recognized
record is `[hexFeatureId, name, [latitude, longitude]]`, sometimes followed by
the decimal CID. Its ID must match the requested place and any optional decimal
ID must agree. Conflicting matching records fail. Coordinate pairs merely near
a CID, viewport arrays, and records for other places are ignored.

The minimized [Matterhorn](test/fixtures/matterhorn.json) and
[Mont Blanc](test/fixtures/mont-blanc.json) fixtures record their source, capture
date, original JSON path, and extracted record. Google can change this format;
unknown structures fail rather than guessing a location.

## Network behavior

Only HTTPS requests to explicitly allowed Google Maps hosts and paths are made.
Every redirect and nested consent destination is validated before use. Cookies
are isolated by conversion and origin; client cookies are never used. Responses
are limited to 3 MB, requests to 10 seconds, and the entire conversion to 30
seconds. Redirect chains are bounded. Transient HTTP errors (including 404) and
network failures are retried twice after 250 ms and 750 ms within that deadline.
The 404 retry is mitigation based on intermittent sharing failures, not a proven
explanation of Google's behavior.

The resolver does not log URLs, place names, coordinates, or response bodies.
Operators must separately configure infrastructure/access logging and establish
capacity and abuse controls before exposing a public endpoint. This repository
change does not deploy an Organic Maps production service.

## Development and verification

Use Node.js 22 or newer:

```sh
npm ci
npm test                 # TypeScript check and deterministic offline tests
npm run format:check
npm run test:live        # Optional: contacts Google for the two landmark fixtures
npx wrangler deploy --dry-run
npm start
```

The tests exercise exact markers versus viewports, labels and DMS validation,
intermediate redirects, CID record identity and ambiguity, sequential/concurrent
request isolation, supported origins, timeouts, retries, and oversized responses.
A successful resolver response does not prove the receiving app displays the
correct place metadata. Organic Maps API-point selection is a separate app test.

## Upstream context

This continues the resolver work discussed in
[proxy PR #1](https://github.com/organicmaps/url-privacy-proxy/pull/1),
[Organic Maps #475](https://github.com/organicmaps/organicmaps/issues/475),
[app PR #5386](https://github.com/organicmaps/organicmaps/pull/5386), and
[iOS sharing #7173](https://github.com/organicmaps/organicmaps/issues/7173).
In particular, the earlier review asked for isolated parsing cases, concrete
fixtures, early host validation, explicit redirects, and removal of global state.
