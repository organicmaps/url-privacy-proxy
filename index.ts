import { IRequest, Router } from 'itty-router';
import { getCoordinates } from './src/coordinates';

const router = Router();

router.get('/coordinates', async (request:IRequest) => {
  const json = await getCoordinates(request);
  if (json === null) {
    return new Response(JSON.stringify({ error: 'Bad Request' }), {
      status: 400,
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    });
  }

  return new Response(json, {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
});

router
  .get('/redirect', async (request:IRequest) => {
    let json_raw:string = await getCoordinates(request);
    let json:any = JSON.parse(json_raw);
    const link = json.url.geo;
    return Response.redirect(link);
  })

  .get('*', async (request) => {
    return new Response(JSON.stringify({ error: 'hey' }));
  });

addEventListener('fetch', (e) => {
  e.respondWith(router.handle(e.request));
});
