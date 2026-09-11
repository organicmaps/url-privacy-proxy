import { getCoordinates, ResolutionError, Fetch } from './src/coordinates';

export async function handleRequest(request: Request, fetcher: Fetch = fetch): Promise<Response> {
  const headers = { 'Content-Type': 'application/json;charset=UTF-8', 'Cache-Control': 'no-store' };
  if (request.method !== 'GET')
    return new Response(JSON.stringify({ error: 'Only GET is supported.' }), { status: 405, headers: { ...headers, Allow: 'GET' } });
  const url = new URL(request.url);
  const path = url.pathname;
  if (path !== '/coordinates' && path !== '/redirect')
    return new Response(JSON.stringify({ error: 'Not found.' }), { status: 404, headers });
  try {
    const input = url.searchParams.get('url');
    if (!input) throw new ResolutionError('Missing url parameter.', 400);
    const result = await getCoordinates(input, fetcher);
    if (path === '/redirect')
      return new Response(null, {
        status: 302,
        headers: { Location: result.url.geo, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
      });
    return new Response(JSON.stringify(result), { headers });
  } catch (error) {
    const status = error instanceof ResolutionError ? error.status : 502;
    const message = error instanceof ResolutionError ? error.message : 'Unable to resolve Google Maps URL.';
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
}

export default { fetch: (request: Request) => handleRequest(request) };
