import { ResolutionError } from './errors';
import { GOOGLE_DOMAINS } from './google-domains';

export interface Point {
  latitude: number;
  longitude: number;
  name: string | null;
  resolution: 'query' | 'marker' | 'cid';
}

const SPECIAL_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'consent.google.com']);

export function validateUrl(input: string): URL {
  if (input.length > 16_384) throw new ResolutionError('Google Maps URL is too long.', 400);
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ResolutionError('Invalid Google Maps URL.', 400);
  }
  const domain = url.hostname.replace(/^(?:www\.|maps\.)/, '');
  if (
    url.protocol !== 'https:' ||
    !(SPECIAL_HOSTS.has(url.hostname) || GOOGLE_DOMAINS.has(domain)) ||
    url.port ||
    url.username ||
    url.password
  )
    throw new ResolutionError('Unsupported Google Maps URL.', 400);
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    throw new ResolutionError('Malformed URL encoding.', 400);
  }
  const validPath =
    url.hostname === 'maps.app.goo.gl' ||
    (url.hostname === 'goo.gl'
      ? path.startsWith('/maps/')
      : url.hostname === 'consent.google.com'
      ? path === '/m'
      : path === '/' || path === '/maps' || path.startsWith('/maps/'));
  if (!validPath) throw new ResolutionError('Unsupported Google Maps path.', 400);
  if (
    path.startsWith('/maps/dir') ||
    ['destination', 'saddr', 'daddr', 'waypoints'].some((key) => url.searchParams.has(key)) ||
    (url.searchParams.has('origin') && path !== '/maps/embed')
  )
    throw new ResolutionError('Directions links are not supported.', 422);
  return url;
}

function coordinates(lat: number, lon: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    throw new ResolutionError('Invalid coordinates.', 422);
  return { latitude: lat, longitude: lon };
}

function pathData(url: URL): string {
  // Split before decoding: an encoded slash in a place name is not a path boundary.
  const segments = url.pathname.split('/');
  const start = segments[1] === 'maps' && segments[2] === 'place' ? 4 : 2;
  const data = segments.slice(start).filter((segment) => segment.startsWith('data='));
  if (data.length > 1) throw new ResolutionError('Multiple Google Maps data components are not supported.');
  return data.length ? decodeURIComponent(data[0].slice('data='.length)) : '';
}

function queryPoint(text: string): Omit<Point, 'resolution'> | null {
  // URLSearchParams already decoded this value. Do not repeatedly decode names or delimiters.
  const decimal = /^(?:(.*)@)?\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (decimal) return { ...coordinates(Number(decimal[2]), Number(decimal[3])), name: decimal[1]?.trim() || null };
  const dms =
    /^(\d+)\s*[°º]\s*(\d+)\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]?\s*([NS])\s*[, ]+\s*(\d+)\s*[°º]\s*(\d+)\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]?\s*([EW])$/i.exec(
      text.trim()
    );
  if (!dms) return null;
  if ([dms[2], dms[3], dms[6], dms[7]].some((value) => Number(value) >= 60)) throw new ResolutionError('Invalid DMS coordinates.');
  const angle = (start: number) =>
    (Number(dms[start]) + Number(dms[start + 1]) / 60 + Number(dms[start + 2]) / 3600) * (/[SW]/i.test(dms[start + 3]) ? -1 : 1);
  return { ...coordinates(angle(1), angle(5)), name: null };
}

export function parseGoogleUrl(url: URL): Point | null {
  if (url.hostname === 'maps.app.goo.gl' || url.hostname === 'goo.gl') return null;
  // The URL has passed validateUrl. Split the raw segment before decoding encoded / and +.
  const place = url.pathname.match(/\/maps\/place\/([^/]+)/)?.[1];
  const name = place ? decodeURIComponent(place.replace(/\+/g, ' ')) : null;
  // The marker differs from /@lat,lon,zoom (the camera viewport).
  const markers = [...pathData(url).matchAll(/!3d([^!]*)!4d([^!]*)/g)];
  if (markers.length > 1) throw new ResolutionError('Multiple markers are not supported.');
  if (markers.length === 1) {
    const [, lat, lon] = markers[0];
    if (![lat, lon].every((value) => /^[+-]?\d+(?:\.\d+)?$/.test(value))) throw new ResolutionError('Invalid marker coordinates.');
    return { ...coordinates(Number(lat), Number(lon)), name, resolution: 'marker' };
  }
  if (getCid(url) || ['query_place_id', 'ftid', 'cid'].some((key) => url.searchParams.has(key))) return null;
  for (const key of ['q', 'query']) {
    const value = url.searchParams.get(key);
    if (value) {
      const point = queryPoint(value);
      if (point) return { ...point, name: point.name || name, resolution: 'query' };
    }
  }
  return null;
}

export function getCid(url: URL): string | null {
  const decimal = url.searchParams.get('cid') || url.searchParams.get('pb')?.match(/!4s(\d+)(?:!|$)/)?.[1];
  if (decimal && /^\d{1,20}$/.test(decimal)) return decimal;
  const ftid = url.searchParams.get('ftid') || pathData(url).match(/!1s(0x[\da-f]+:0x[\da-f]+)(?:!|$)/i)?.[1];
  const hex = ftid?.match(/^0x[\da-f]+:(0x[\da-f]{1,16})$/i)?.[1];
  return hex ? BigInt(hex).toString(10) : null;
}

export function embedUrl(url: URL): URL | null {
  if (url.pathname === '/maps/embed' || url.searchParams.get('output') === 'embed') return null;
  const identity = getCid(url);
  if (!identity) return null;
  const result = new URL('https://maps.google.com/maps');
  result.searchParams.set('cid', identity);
  result.searchParams.set('output', 'embed');
  return result;
}

function embedPayload(html: string): unknown {
  // Locate the array, then balance it without interpreting delimiters inside JSON strings.
  const initializer = /\binitEmbed\s*\(\s*(?=\[)/.exec(html);
  if (!initializer) return null;
  const start = initializer.index + initializer[0].length;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let end = start; end < html.length; ++end) {
    const char = html[end];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') {
      quoted = true;
    } else if (char === '[') {
      ++depth;
    } else if (char === ']' && --depth === 0) {
      if (!/^\s*\)\s*;/.test(html.slice(end + 1))) break;
      // Never execute the surrounding JavaScript; JSON.parse validates the captured array.
      return JSON.parse(html.slice(start, end + 1));
    }
  }
  throw new ResolutionError('Unrecognized Google embed payload.', 502);
}

export function parseEmbed(url: URL, html: string): Point | null {
  const identity = getCid(url);
  if (!identity) return null;
  let root: unknown;
  try {
    root = embedPayload(html);
  } catch {
    throw new ResolutionError('Unrecognized Google embed payload.', 502);
  }
  const pending: unknown[] = [root];
  let result: Point | null = null;
  while (pending.length) {
    const value = pending.pop();
    if (!Array.isArray(value)) continue;
    // Matterhorn record: ["0x478f3368cbb9ecd9:0x9826458cace55849", "Matterhorn",
    //   [45.9765738,7.658451899999999]]. Some records also have the decimal CID as a
    // fourth field. Match the whole record and its ID, not nearby coordinates.
    if (
      (value.length === 3 || value.length === 4) &&
      typeof value[0] === 'string' &&
      typeof value[1] === 'string' &&
      Array.isArray(value[2]) &&
      value[2].length === 2 &&
      value[2].every((v: unknown) => typeof v === 'number') &&
      (value.length === 3 || value[3] === identity)
    ) {
      const hex = value[0].match(/^0x[\da-f]+:(0x[\da-f]{1,16})$/i)?.[1];
      if (!hex || BigInt(hex).toString(10) !== identity) continue;
      const point = { ...coordinates(value[2][0], value[2][1]), name: value[1], resolution: 'cid' as const };
      if (result && (result.latitude !== point.latitude || result.longitude !== point.longitude || result.name !== point.name))
        throw new ResolutionError('Conflicting records for the Google place.');
      result = point;
    }
    for (const child of value) if (Array.isArray(child)) pending.push(child);
  }
  return result;
}
