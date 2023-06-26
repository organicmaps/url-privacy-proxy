// Below is the main function to get coordinates from a specific url which is called in redirect or search route.
// The logic of the proxy is that in the backend code of the site, there lies its coordinates but are located absurdly at different locations when made sepearate calls, but always along with a URI starting with "https://www.google.com/maps/preview/place/" or if not there then with "https://maps.google.com/maps/api/staticmap?center=". Note that if the first URI is not there then only we have to look up for the second one.

export async function getCoordinates(request) {
  async function gatherResponse(response) {
    const { headers } = response;
    return response.json();
  }
  const init = {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  };
  var reqBody = null;
  var lati = null;
  var lng = null;
  var urllen = request.query.url.length;
  var string = '';
  for (const key in request.query) {
    if (request.query.hasOwnProperty(key) && key != 'url') {
      string = '%26' + key + request.query[key];
      request.query.url = encodeURI(request.query.url + string);
    }
  }
  function decodeURITillSame(uri) {
    let decodedURI = decodeURI(uri);
    while (decodedURI !== uri) {
      uri = decodedURI;
      decodedURI = decodeURI(uri);
    }
    return decodedURI;
  }
  request.query.url = decodeURITillSame(request.query.url);
  var originalUrl = request.query.url;
  await fetch(request.query.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0',
      'Accept-Language': 'en;q=0.8',
      DNT: '1',
    },
  })
    .then((value1) => {
      return value1;
    })
    .then(async (value2) => {
      var url = value2.url;
      if (url.endsWith('ucbcb=1')) {
        url = decodeURIComponent(url);
        originalUrl = url;
      }
      if (urllen > url.length) {
        url = encodeURI(request.query.url);
      }
      reqBody = url;
      url = url.toString();
      url = encodeURI(url);
      const urlObj = new URL(url);
      const continueParam = urlObj.searchParams.get('continue'); // sometimes while using the proxy and sending an request to the specific URI, it returns with www.google.com/sorry?continue={UNSHORTENED URI} , so this step becomes neccesary.
      if (continueParam) {
        url = decodeURIComponent(continueParam);
        originalUrl = decodeURIComponent(continueParam);
        reqBody = url;
      } else {
      }
      var { pathname, host, hash, search } = new URL(url);
      var newUrl = pathname;
      const array = newUrl.split('/');
      if (host === 'www.google.com' || host === 'maps.google.com') {
        async function gatherResponse(response) {
          return response.text();
        }
        var response = await fetch(url);
        var results = await gatherResponse(response);
        try {
          var position = results.indexOf(';markers');
          var link = results.substring(position - 1, position + 70);
          link = link.split('=')[1];
          lati = link.split('%2C')[0];
          lng = link.split('%2C')[1].split('%7C')[0];
        } catch {
          position = results.indexOf('https://www.google.com/maps/preview/place/');
          link = results.substring(position - 1, position + 250);
          var val = link.split('@')[1];
          try {
            lati = val.split(',')[0];
            lng = val.split(',')[1];
          } catch {
            position = results.indexOf('https://maps.google.com/maps/api/staticmap?center=');
            link = results.substring(position - 1, position + 250);
            var latlng = link.split('=')[1];
            lati = latlng.split('%2C')[0];
            lng = latlng.split('%2C')[1].split('&')[0];
          }
        }
      }
    });
  lati = decodeURIComponent(decodeURIComponent(lati.toString())).trim();
  lng = decodeURIComponent(decodeURIComponent(lng.toString())).trim();
  console.log(lati, lng);
  if (lati.charAt(0) === '+') {
    lati = lati.substring(1);
  }
  if (lng.charAt(0) === '+') {
    lng = lng.substring(1);
  }
  lati = parseFloat(lati);
  lng = parseFloat(lng);
  reqBody = `geo:${lati},${lng}`;
  var reqDesc = {
    geo: `${reqBody}`,
    openstreetmap: `https://www.openstreetmap.org/?mlat=${lati}&mlon=${lng}`,
  };
  var coordinates = {
    latitude: lati,
    longitude: lng,
  };
  const retBody = {
    url: ``,
    source: `${originalUrl}`,
    coordinates: ``,
  };
  retBody.coordinates = coordinates;
  retBody.url = reqDesc;
  const json = JSON.stringify(retBody, null, 2);
  return json;
}