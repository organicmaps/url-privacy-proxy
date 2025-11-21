import { IRequest, Router } from 'itty-router';
import { getCoordinates } from './src/coordinates';

const router = Router();

router.get('/coordinates', async (request:IRequest) => {
  const json:string|null = await getCoordinates(request);
  if (json === null) {
    return new Response(JSON.stringify({ error: "Can't decode coordinates from URL" }), {
      status: 404,
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

  .get('*', async (request:IRequest) => {
    return new Response(JSON.stringify({ error: 'Unknown endpoint' }),
      {
        status: 404,
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
      });
  });

export default { ...router }
