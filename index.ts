import { Router } from 'itty-router';
import { getCoordinates } from './src/coordinates';

const router = Router();

router.get('/coordinates', async (request) => {
  const json = await getCoordinates(request);
  return new Response(json, {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
});

router.get('/redirect', async (request) => {
  let json = await getCoordinates(request);
  json = JSON.parse(json);
  const link = json.url.geo;
  return Response.redirect(link);
});

router.get('*', async (request) => {
  return new Response(JSON.stringify({ error: 'hey' }));
});

addEventListener('fetch', async (e) => {
  e.respondWith(await router.handle(e.request));
});
