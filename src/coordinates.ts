import { parseGoogleUrl, parseEmbed, embedUrl, validateUrl, Point } from './google';
import { ResolutionError } from './errors';
export { ResolutionError } from './errors';

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const MAX_TIME_MS = 30_000;
const MAX_REQUEST_MS = 10_000;
const MAX_BYTES = 3_000_000;
const MAX_HOPS = 8;
const RETRY_DELAYS = [250, 750];
const RETRY_STATUSES = new Set([404, 408, 429, 500, 502, 503, 504]);

async function readBody(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new ResolutionError('Google response is too large.', 502);
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
}

async function requestGoogle(url: URL, fetcher: Fetch, deadline: number, cookies: Map<string, string>) {
  for (let attempt = 0; ; ++attempt) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ResolutionError('Google resolution timed out.', 504);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(MAX_REQUEST_MS, remaining));
    try {
      const headers: Record<string, string> = {
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      };
      // Cookies belong to one conversion and one origin. Never forward client cookies.
      if (cookies.size) headers.Cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
      const response = await fetcher(url.href, { redirect: 'manual', headers, signal: controller.signal });
      const cookieHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
      const values = cookieHeaders.getSetCookie?.() ?? (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')!] : []);
      for (const value of values) {
        const pair = value.split(';', 1)[0];
        const separator = pair.indexOf('=');
        if (separator > 0) cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1));
      }
      if (RETRY_STATUSES.has(response.status) && attempt < RETRY_DELAYS.length) {
        await response.body?.cancel();
      } else if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new ResolutionError('Google redirect has no Location header.', 502);
        return { location, html: '' };
      } else {
        if (!response.ok) {
          await response.body?.cancel();
          throw new ResolutionError(`Google returned HTTP ${response.status}.`, 502);
        }
        return { location: null, html: await readBody(response) };
      }
    } catch (error) {
      if (error instanceof ResolutionError) throw error;
      if (attempt >= RETRY_DELAYS.length) {
        throw new ResolutionError(
          controller.signal.aborted ? 'Google resolution timed out.' : 'Google request failed.',
          controller.signal.aborted ? 504 : 502
        );
      }
    } finally {
      clearTimeout(timeout);
    }
    const delay = RETRY_DELAYS[attempt];
    if (Date.now() + delay >= deadline) throw new ResolutionError('Google resolution timed out.', 504);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export async function resolveGoogle(input: string, fetcher: Fetch = fetch): Promise<Point> {
  let url = validateUrl(input);
  if (url.hostname === 'maps.app.goo.gl') {
    // g_st added by Share Sheet/Shortcuts has caused bare-pin short links to fail.
    // The opaque path identifies the share; query parameters are not needed.
    url.search = '';
    url.hash = '';
  }
  const deadline = Date.now() + MAX_TIME_MS;
  const visited = new Set<string>();
  const jars = new Map<string, Map<string, string>>();
  for (let hop = 0; hop <= MAX_HOPS; ++hop) {
    if (url.hostname === 'consent.google.com') {
      const destination = url.searchParams.get('continue');
      if (!destination) throw new ResolutionError('Google consent URL has no destination.', 502);
      url = validateUrl(destination);
    }
    // Inspect every redirect before following it: later redirects can lose a pin.
    const point = parseGoogleUrl(url);
    if (point) return point;
    url = embedUrl(url) ?? url;
    let cookies = jars.get(url.origin);
    if (!cookies) jars.set(url.origin, (cookies = new Map()));
    const key = url.href + JSON.stringify([...cookies]);
    if (visited.has(key)) throw new ResolutionError('Google redirect loop.', 502);
    visited.add(key);
    const response = await requestGoogle(url, fetcher, deadline, cookies);
    if (response.location) {
      url = validateUrl(new URL(response.location, url).href);
      continue;
    }
    const result = parseEmbed(url, response.html);
    if (result) return result;
    throw new ResolutionError('Google did not expose unambiguous place coordinates.');
  }
  throw new ResolutionError('Too many Google redirects.', 502);
}

export async function getCoordinates(request: Request, fetcher: Fetch = fetch) {
  const input = new URL(request.url).searchParams.get('url');
  if (!input) throw new ResolutionError('Missing url parameter.', 400);
  const point = await resolveGoogle(input, fetcher);
  const { latitude, longitude } = point;
  return {
    source: input,
    coordinates: { latitude, longitude },
    name: point.name,
    resolution: point.source,
    url: {
      geo: `geo:${latitude},${longitude}`,
      openstreetmap: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}`,
    },
  };
}
