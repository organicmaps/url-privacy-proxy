// Below is the main function to get coordinates from a specific url which is called in redirect or coordinates route.
// The logic of the proxy is that in the back HTML code of the site, there may lie some different URIs which contain the coordinates, although it is hard to predict which one will be there so we check one by one by using try catch blocks. Also extracting coordinates from plus codes is also utilised which may not require the back HTML code.
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
  function decodeURIComponentTillSame(uri) { // This function is often called in the code flow because sometimes Google throws highly encoded URIs.
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
      if (url.endsWith('ucbcb=1')) {    // Now this is out of pure observation that while sending too many requests over a small span of time, Google begins to mark those a activity, while sending the expanded URI with "&ucbcb=1" parameter along with it.
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
      const continueParam = urlObj.searchParams.get('continue'); // Sometimes while using the proxy and sending an request to the specific URI, it returns with https://www.google.com/sorry/index?continue={URI} , so this step becomes neccesary.
      if (continueParam) {
        url = decodeURITillSame(continueParam);
        url = decodeURIComponentTillSame(url);
        url = decodeURIComponent(url);
        originalUrl = url;
        reqBody = url;
      }
      var { pathname, host, hash, search } = new URL(url);

      const array = url.split('/');   // Stores an array which contains parts of the url which are separated if they have an "/" between them. Example:- ""https://maps.google.com?q=VGR4+5MC+Falafel+M.+Sahyoun,+Beirut,+Lebanon&ftid=0x151f16e2123697fd:0x8e6626b678863990&hl=en-US&gl=tr&entry=gps&lucs=47067413&g_ep=CAISBjYuNjQuMxgAINeCAyoINDcwNjc0MTNCAlJV" is split into array whose array[arrLength-1] will be "maps.google.com?q=VGR4+5MC+Falafel+M.+Sahyoun,+Beirut,+Lebanon&ftid=0x151f16e2123697fd:0x8e6626b678863990&hl=en-US&gl=tr&entry=gps&lucs=47067413&g_ep=CAISBjYuNjQuMxgAINeCAyoINDcwNjc0MTNCAlJV" (in some URIs this part is even smaller) as you can see this part contains plus code and address in this specific use case which will be utilised further.
      const arrLength = array.length;
      try {
        // PLUS CODE MECHANISM UTILISED:- In the following lines of code firstly the address is separated from plus code. The plus code we get is a shortened plus code so it won't be of use untill we expand it. For this we need to understand plus code making mechanism in itself.
        // For every letter of plus code from left to right the accuracy of the coordinates becomes more precise and only expanded plus codes can be converted to coordinates. For example in "849VCWC8+R9" the "849V" would be same for the city at any point but the additional "CWC8+R9" is locality specific. Read more :- https://www.dcode.fr/open-location-code
        // So in the below use case I first separate plus code from address, then retreive the center of the city coordinates by Nominatim API and then convert them to plus code using Google API (it gives expanded plus codes). Then I pick the initial four letters of the plus code of the city and add the rest of the plus code given in the URI and then make a plus code which corresponds to the same point/locality. (Note that this step can be shortened to a single API call via a Google API but it is costly.)
        console.log(url);
        const qParam = urlObj.searchParams.get('q');  // This gets the qParam from the above mentioned part of URL and then splits them apart into plus code and address
        if (qParam) {
          console.log(array[arrLength - 1].split('=')[1]);
          var address = array[arrLength - 1].split('=')[1];
          link = decodeURIComponentTillSame(address);
        }
        var cityandState = link.split(',')[link.split(',').length - 2] + link.split(',')[link.split(',').length - 1];  // Now this part stores the city and state/province of which the address is of.
        async function gatherResponse(response) {
          return response.json();
        }
        const response = await fetch(`https://geocode.maps.co/search?q=${cityandState}`); // This send an API request to retreive the center of the city.
        const results = await gatherResponse(response);
        var lat = results[0].lat;
        var lon = results[0].lon;
        const res = await fetch(`https://plus.codes/api?address=${lat},${lon}&email=kartikaysaxena12@gmail.com`); // Utilises the latitude and longitude to retreive the plus codes of the center of the city.
        const result = await gatherResponse(res);
        var global_code = result.plus_code.global_code;
        var pc = link.split('+')[0] + '%2B' + link.split('+')[1];
        var pc_final = global_code.substring(0, 4) + pc.substring(0, pc.length); // Prepares the plus code from the city center plus code and plus code in the URI and then retreive the location coordinates from the prepared plus code.
        const api = await fetch(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`); 
        console.log(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`);
        const final = await gatherResponse(api);
        lati = final.plus_code.geometry.location.lat;
        lng = final.plus_code.geometry.location.lng;
      } catch {
        try {
          // Now this method is kind of similar like the above method, the only difference here is that the address along with the plus code is stored in the back HTML code (specifically in the meta tag here with an attribute [itemprop="name"]). Cheerio library is utilised here to load the back HTML and extract the address from the specific meta tag.
          async function gatherResponse(response) {
            return response.text(); // Returns the HTML code.
          }
          var response = await fetch(url); 
          var results = await gatherResponse(response); // results contains the HTML code.
          const $ = cheerio.load(results); // It loads the HTML code via the library which we can further access like an object.
          let address = $('[itemprop="name"]').attr('content');  // The address is stored in this. Next the same procedure is followed just like in the above use case.
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
          // Now in this use case the HTML code in the backend has an URI in it which has the coordinates (For example for URI:- "https://maps.google.com/maps/api/staticmap?center=28.3875877%2C79.4334719&amp;zoom=16&amp;size=900x900&amp;language=en&amp;markers=28.3873906%2C79.4332585&amp;sensor=false&amp;client=google-maps-frontend&amp;signature=n8UGrbdCp1219NbZQizcgHHBddE" The backend URI which has coordinates is like "https://maps.google.com/maps/api/staticmap?center=28.3875877%2C79.4334719&amp;zoom=16&amp;size=900x900&amp;language=en&amp;markers=28.3873906%2C79.4332585&amp;sensor=false&amp;client=google-maps-frontend&amp;signature=n8UGrbdCp1219NbZQizcgHHBddE") which has ";markers" in it (it is unique in the entire HTML code). So we extract this
          if (host === 'www.google.com' || host === 'maps.google.com') {
            async function gatherResponse(response) {
              return response.text();
            }
            var response = await fetch(url);
            var results = await gatherResponse(response);
            console.log(results)
            try {
              console.log('first');
              var position = results.indexOf(';markers'); // Gets the index of ;markers in the code.
              var link = results.substring(position - 1, position + 70); // extracts the string nearby it
              link = link.split('=')[1]; // Gets the latitude and longitude from it
              lati = link.split('%2C')[0]; 
              lng = link.split('%2C')[1].split('%7C')[0];
            } catch {
              try {
                // Now this is similar to the above use cases, we get the coordinates from an URI in the HTML code which starts with "https://www.google.com/maps/preview/place/" 
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
                  // Again similar, we get the coordinates from an URI in the HTML code which starts with "https://maps.google.com/maps/api/staticmap?center="
                  console.log('third')
                  position = results.indexOf('https://maps.google.com/maps/api/staticmap?center=');
                  link = results.substring(position - 1, position + 250);
                  var latlng = link.split('=')[1];
                  lati = latlng.split('%2C')[0];
                  lng = latlng.split('%2C')[1].split('&')[0];
                }
              }
              // Below are the simlar use cases with different search strings. The point of this being implemented is that there are some cases when only one URI is present in the backend which has the coordinates and we can't predict that so we have to check them one by one using try catch statements to avoid errors.
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
  if (lati.charAt(0) === '+') {  // Sometimes coordinates are extracted as +24.678,89.909 or +23.546,-12.845. And in these type of coordinates a positive or negative sign accompanies them, while the negative sign seems to fit with the geo URI scheme (because of negative coordinates), the positive sign isn't so we have to remove the positive sign.
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
