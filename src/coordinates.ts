// Below is the main function to get coordinates from a specific url which is called in redirect or search route.
// The logic of the proxy is that in the backend code of the site, there lies its coordinates but are located absurdly at different locations when made sepearate calls, but always along with a URI starting with "https://www.google.com/maps/preview/place/" or if not there then with "https://maps.google.com/maps/api/staticmap?center=". Note that if the first URI is not there then only we have to look up for the second one.
const cheerio = require('cheerio');

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
    decodedURI = decodeURIComponentTillSame(decodedURI);
    return decodedURI;
  }
  function decodeURIComponentTillSame(uri) {
    let decodedURI = decodeURIComponent(uri);
    while (decodedURI !== uri) {
      uri = decodedURI;
      decodedURI = decodeURIComponent(uri);
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
        url = decodeURITillSame(continueParam);
        url = decodeURIComponentTillSame(url);
        url = decodeURIComponent(url);
        originalUrl = url;
        reqBody = url;
      }
      var { pathname, host, hash, search } = new URL(url);

      var newUrl = pathname;
      const array = url.split('/');
      const arrLength = array.length;
      const path = pathname + search + hash;
      try {
        console.log(url);
        const qParam = urlObj.searchParams.get('q');
        if (qParam) {
          console.log(array[arrLength - 1].split('=')[1]);
          var address = array[arrLength - 1].split('=')[1];
          link = decodeURIComponentTillSame(address);
        }
        var cityandState = link.split(',')[link.split(',').length - 2] + link.split(',')[link.split(',').length - 1];
        async function gatherResponse(response) {
          return response.json();
        }
        const response = await fetch(`https://geocode.maps.co/search?q=${cityandState}`);
        const results = await gatherResponse(response);
        var lat = results[0].lat;
        var lon = results[0].lon;
        const res = await fetch(`https://plus.codes/api?address=${lat},${lon}&email=kartikaysaxena12@gmail.com`);
        const result = await gatherResponse(res);
        var global_code = result.plus_code.global_code;
        var pc = link.split('+')[0] + '%2B' + link.split('+')[1];
        var pc_final = global_code.substring(0, 4) + pc.substring(0, pc.length);
        const api = await fetch(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`);
        console.log(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`);
        const final = await gatherResponse(api);
        lati = final.plus_code.geometry.location.lat;
        lng = final.plus_code.geometry.location.lng;
      } catch {
        try {
          console.log('hellllllooooooooooo');
          async function gatherResponse(response) {
            return response.text();
          }
          var response = await fetch(url);
          var results = await gatherResponse(response);
          const $ = cheerio.load(results);
          let address = $('[itemprop="name"]').attr('content');
          console.log(address);
          let plucodeAddress = address.split('·')[1];
          let plusCode = plucodeAddress.substring(1, 5) + '%2B' + plucodeAddress.substring(6, 9);
          console.log(plusCode);
          link = plucodeAddress;
          var cityandState = link.split(',')[link.split(',').length - 3] + link.split(',')[link.split(',').length - 2];
          console.log(cityandState);
          response = await fetch(`https://geocode.maps.co/search?q=${cityandState}`);
          results = await gatherResponse(response);
          console.log(results);
          results = JSON.parse(results);
          var lat = results[0].lat;
          var lon = results[0].lon;
          console.log(lat);
          console.log(lon);
          const res = await fetch(`https://plus.codes/api?address=${lat},${lon}&email=kartikaysaxena12@gmail.com`);
          let result = await gatherResponse(res);
          result = JSON.parse(result);
          console.log(global_code);
          var global_code = result.plus_code.global_code;
          console.log(global_code);
          var pc_final = global_code.substring(0, 4) + plusCode.substring(0, plusCode.length);
          console.log(plusCode);
          console.log(pc_final);
          let api = await fetch(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`);
          console.log(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`);
          let final = await gatherResponse(api);
          final = JSON.parse(final);
          lati = final.plus_code.geometry.location.lat;
          lng = final.plus_code.geometry.location.lng;
        } catch {
          if (host === 'www.google.com' || host === 'maps.google.com') {
            async function gatherResponse(response) {
              return response.text();
            }
            var response = await fetch(url);
            var results = await gatherResponse(response);
            console.log(results)
            try {
              console.log('first');
              var position = results.indexOf(';markers');
              var link = results.substring(position - 1, position + 70);
              link = link.split('=')[1];
              lati = link.split('%2C')[0];
              lng = link.split('%2C')[1].split('%7C')[0];
            } catch {
              try {
                console.log('second')
                position = results.indexOf('https://www.google.com/maps/preview/place/');
                link = results.substring(position - 1, position + 250);
                var val = link.split('@')[1];
                try {
                  console.log('testing')
                  console.log(val,link)
                  lati = val.split(',')[0];
                  lng = val.split(',')[1];
                  lati = lati.toString()
                  lng = lng.toString()
                } catch {
                  console.log('third')
                  position = results.indexOf('https://maps.google.com/maps/api/staticmap?center=');
                  link = results.substring(position - 1, position + 250);
                  var latlng = link.split('=')[1];
                  lati = latlng.split('%2C')[0];
                  lng = latlng.split('%2C')[1].split('&')[0];
                }
              }
              catch {
                try {
                  console.log('fourth')
                  position =results.indexOf('https://www.google.com/maps/place/')
                  link = results.substring(position - 1, position + 250);
                  var val = link.split('@')[1];
                  console.log(val)
                  lati = val.split(',')[0];
                  lng = val.split(',')[1];
                }
                catch {
                  console.log('fifth')
                  let searchString = 'https://www.google.com/maps/search/'
                  position = searchString.length + results.indexOf('https://www.google.com/maps/search/')
                  link = results.substring(position,position+250)
                  console.log(link)
                  lati = link.split(',')[0]
                  lng = link.split(',')[1].split('?')[0]
                }
              }
            }
          }
        }
      }
    });
    console.log(lati)
    console.log(lng)
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
