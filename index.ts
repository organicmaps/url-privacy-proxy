import { Router } from 'itty-router'
import { getCoordinates } from './src/coordinates'

const router = Router()

router.get('/search',async request => {
    var json = await getCoordinates(request)
     return new Response(json, {
         headers: {
           "content-type": "application/json;charset=UTF-8",
         },
       }); 
 })

 router.get('/redirect',async request => {
     var json = await getCoordinates(request)
     json = JSON.parse(json)
     var link = json.url.geo
     return Response.redirect(link)
 })

 .get('*',(request:Request) => {
     return new Response(
         JSON.stringify({error:'hey'})
     )
 })
addEventListener('fetch', (e) => {
  e.respondWith(router.handle(e.request))
})