import { Router } from 'itty-router'

// Create a new router
const router = Router()

/*
Our index route, a simple hello world.
*/
async function getCoordinates(request) {
	async function gatherResponse(response) {
        const { headers } = response;
        return response.json();
      }
      const init = {
        headers: {
          "content-type": "application/json;charset=UTF-8",
        },
      };
      var reqBody= null
	  var lati = null
	  var lng = null
	  var urllen = request.query.url.length
	  var string =''
	  for (const key in request.query) {
		if (request.query.hasOwnProperty(key) && key!='url') {
		  string = '%26' + key + request.query[key]
		  request.query.url = encodeURI(request.query.url + string)
		}
	  }
	  var originalUrl = request.query.url
      await fetch(request.query.url, {
		headers: {
			"User-Agent": "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0",
			"Accept-Language": "en;q=0.8",
			"DNT": "1",
		}
	  })
      .then((value1)=> {
          return value1
      }).then(async (value2)=> {
		var url = value2.url
		if (url.endsWith("ucbcb=1"))
		{
			url = decodeURIComponent(url)
			originalUrl =url
		}
		if(urllen>url.length)
		{
			url =encodeURI(request.query.url) 
		}
        reqBody = url
		url = url.toString()
		url = encodeURI(url)
		const urlObj = new URL(url);
		const continueParam = urlObj.searchParams.get("continue"); // sometimes while using the proxy and sending an request to the specific URI, it returns with www.google.com/sorry?continue={UNSHORTENED URI} , so this step becomes neccesary.
		if (continueParam) {
			url = decodeURIComponent(continueParam)
			originalUrl = decodeURIComponent(continueParam)
			reqBody = url
		  } else {
		  }
		 var {pathname,host,hash,search} = new URL(url)
		 var newUrl = pathname
		 const array = newUrl.split('/')  
		 if (host==='www.google.com' || host==='maps.google.com')
		 {
			async function gatherResponse(response) {
				return response.text();
			}
			var response = await fetch(url)
			var results = await gatherResponse(response);
			var pos = results.indexOf('https://www.google.com/maps/preview/place/')
			var link = results.substring(pos - 1, pos + 250)
			var val = link.split('@')[1]
			try {
				lati = val.split(',')[0]
				lng = val.split(',')[1]
			}
			catch {
				pos = results.indexOf('https://maps.google.com/maps/api/staticmap?center=')
				link = results.substring(pos - 1, pos + 250)
				var latlng = link.split('=')[1]
				lati = latlng.split('%2C')[0]
				lng = latlng.split('%2C')[1].split('&')[0]
			}
      }})
      lati = decodeURIComponent(decodeURIComponent(lati.toString())).trim()
      lng = decodeURIComponent(decodeURIComponent(lng.toString())).trim() 
    if (lati.charAt(0)==='+')
    {
        lati = lati.substring(1)
    }
    if (lng.charAt(0)==='+')
    {
        lng = lng.substring(1)
    }
    lati = parseFloat(lati)
    lng = parseFloat(lng)
    reqBody = `geo:${lati},${lng}`
      var reqDesc =  
	  {
		  geo: `${reqBody}`,
		  openstreetmap: `https://www.openstreetmap.org/?mlat=${lati}&mlon=${lng}`
	  }
	var coordinates =
	{
		latitude: lati,
		longitude: lng
	}
      const retBody = {
		url:``,
		source:`${originalUrl}`,
		coordinates: ``
	}
	retBody.coordinates = coordinates
	retBody.url = reqDesc
    const json = JSON.stringify(retBody, null, 2);
	return json
}

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

/*
This route demonstrates path parameters, allowing you to extract fragments from the request
URL.

Try visit /example/hello and see the response.
*/

/*
This shows a different HTTP method, a POST.

Try send a POST request using curl or another tool.

Try the below curl command to send JSON:

$ curl -X POST <worker> -H "Content-Type: application/json" -d '{"abc": "def"}'
*/

/*
This is the last route we define, it will match anything that hasn't hit a route we've defined
above, therefore it's useful as a 404 (and avoids us hitting worker exceptions, so make sure to include it!).

Visit any page that doesn't exist (e.g. /foobar) to see it in action.
*/
router.all("*", () => new Response("404, not found!", { status: 404 }))

/*
This snippet ties our worker to the router we deifned above, all incoming requests
are passed to the router where your routes are called and the response is sent.
*/
addEventListener('fetch', (e) => {
  e.respondWith(router.handle(e.request))
})