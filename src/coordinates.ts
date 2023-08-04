const cheerio = require('cheerio');

let urlObj;
let continueParam; // Sometimes while using the proxy and sending an request to the specific URI, it returns with https://www.google.com/sorry/index?continue={URI} , so this step becomes neccesary.
let array; // Stores an array which contains parts of the url which are separated if they have an "/" between them. Example:- ""https://maps.google.com?q=VGR4+5MC+Falafel+M.+Sahyoun,+Beirut,+Lebanon&ftid=0x151f16e2123697fd:0x8e6626b678863990&hl=en-US&gl=tr&entry=gps&lucs=47067413&g_ep=CAISBjYuNjQuMxgAINeCAyoINDcwNjc0MTNCAlJV" is split into array whose array[arrLength-1] will be "maps.google.com?q=VGR4+5MC+Falafel+M.+Sahyoun,+Beirut,+Lebanon&ftid=0x151f16e2123697fd:0x8e6626b678863990&hl=en-US&gl=tr&entry=gps&lucs=47067413&g_ep=CAISBjYuNjQuMxgAINeCAyoINDcwNjc0MTNCAlJV" (in some URIs this part is even smaller) as you can see this part contains plus code and address in this specific use case which will be utilised further.
let arrLength;
let originalUrl;
let reqBody;
let lati;
let lng = null;
let urllen;
let string;
let url;
let link;
let json;
let coordinates = {
  latitude: null,
  longitude: null,
};
let position;
let results;

async function gatherResponse(response) {
  return response.json();
}

async function gatherResponseText(response) {
  return response.text(); // Returns the HTML code.
}

function decodeURITillSame(uri) {
  let decodedURI = decodeURI(uri);
  while (decodedURI !== uri) {
    uri = decodedURI;
    decodedURI = decodeURI(uri);
  }

  function decodeURIComponentTillSame(uri) {
    // This function is often called in the code flow because sometimes Google throws highly encoded URIs.
    let decodedURI = decodeURIComponent(uri);
    while (decodedURI !== uri) {
      uri = decodedURI;
      decodedURI = decodeURIComponent(uri);
    }
    return decodedURI;
  }
  decodedURI = decodeURIComponentTillSame(decodedURI);
  return decodedURI;
}

function decodeURIComponentTillSame(uri) {
  // This function is often called in the code flow because sometimes Google throws highly encoded URIs.
  let decodedURI = decodeURIComponent(uri);
  while (decodedURI !== uri) {
    uri = decodedURI;
    decodedURI = decodeURIComponent(uri);
  }
  return decodedURI;
}

async function gatherResponse(response) {
  const { headers } = response;
  return response.json();
}

async function extractCoordinatesFromPlusCode(url) {
  // Implementation of extracting coordinates from Plus Codes
  // Return an object { latitude, longitude } if successful, otherwise null
  try {
    console.log(url);
    console.log(array);
    console.log(arrLength);
    const qParam = urlObj.searchParams.get('q'); // This gets the qParam from the above mentioned part of URL and then splits them apart into plus code and address
    if (qParam) {
      console.log(array[arrLength - 1].split('=')[1]);
      var address = array[arrLength - 1].split('=')[1];
      link = decodeURIComponentTillSame(address);
    }
    link = decodeURITillSame(address);
    console.log('here2');
    var cityandState = link.split(',')[link.split(',').length - 2] + link.split(',')[link.split(',').length - 1]; // Now this part stores the city and state/province of which the address is of.
    console.log('hmm');
    const response = await fetch(`https://geocode.maps.co/search?q=${cityandState}`); // This send an API request to retreive the center of the city.
    const results = await gatherResponse(response);
    console.log(cityandState);
    console.log(response);
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
    var coordinates = {
      latitude: null,
      longitude: null,
    };
    coordinates.latitude = lati;
    coordinates.longitude = lng;
    return coordinates;
  } catch (error) {
    console.log('Error while extracting coordinates from Plus Codes:', error);
    return null;
  }
}

async function extractCoordinatesFromPlusCode2(url) {
  try {
    var response = await fetch(url);
    var results = await gatherResponseText(response); // results contains the HTML code.
    const $ = cheerio.load(results); // It loads the HTML code via the library which we can further access like an object.
    let address = $('[itemprop="name"]').attr('content'); // The address is stored in this. Next the same procedure is followed just like in the above use case.
    console.log(address);
    let plucodeAddress = address.split('·')[1];
    let plusCode = plucodeAddress.substring(1, 5) + '%2B' + plucodeAddress.substring(6, 9);
    console.log(plusCode);
    link = plucodeAddress;
    var cityandState = link.split(',')[link.split(',').length - 3] + link.split(',')[link.split(',').length - 2];
    console.log(cityandState);
    response = await fetch(`https://geocode.maps.co/search?q=${cityandState}`);
    results = await gatherResponseText(response);
    console.log(results);
    results = JSON.parse(results);
    var lat = results[0].lat;
    var lon = results[0].lon;
    console.log(lat);
    console.log(lon);
    const res = await fetch(`https://plus.codes/api?address=${lat},${lon}&email=kartikaysaxena12@gmail.com`);
    let result = await gatherResponseText(res);
    result = JSON.parse(result);
    console.log(global_code);
    var global_code = result.plus_code.global_code;
    console.log(global_code);
    var pc_final = global_code.substring(0, 4) + plusCode.substring(0, plusCode.length);
    console.log(plusCode);
    console.log(pc_final);
    let api = await fetch(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`);
    console.log(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`);
    let final = await gatherResponseText(api);
    final = JSON.parse(final);
    lati = final.plus_code.geometry.location.lat;
    lng = final.plus_code.geometry.location.lng;
    coordinates.latitude = lati;
    coordinates.longitude = lng;
    return coordinates;
  } catch (error) {
    console.log('Error while extracting coordinates from HTML Method 1:', error);
    return null;
  }
}

async function extractCoordinatesFromHTMLMethod1(url) {
  try {
    var response = await fetch(url);
    var results = await gatherResponseText(response);
    console.log(results);
    var position = results.indexOf(';markers'); // Gets the index of ;markers in the code.
    var link = results.substring(position - 1, position + 70); // extracts the string nearby it
    link = link.split('=')[1]; // Gets the latitude and longitude from it
    lati = link.split('%2C')[0];
    lng = link.split('%2C')[1].split('%7C')[0];
    coordinates.latitude = lati;
    coordinates.longitude = lng;
    return coordinates;
  } catch (error) {
    console.log('Error while extracting coordinates from HTML Method 2:', error);
    return null;
  }
}

async function extractCoordinatesFromHTMLMethod2(url) {
  try {
    var response = await fetch(url);
    var results = await gatherResponseText(response);
    console.log(results);
    console.log('second');
    let position = results.indexOf('https://www.google.com/maps/preview/place/');
    link = results.substring(position - 1, position + 250);
    var val = link.split('@')[1];
    console.log('testing');
    console.log(val, link);
    lati = val.split(',')[0];
    lng = val.split(',')[1];
    lati = lati.toString();
    lng = lng.toString();
    coordinates.latitude = lati;
    coordinates.longitude = lng;
    return coordinates;
  } catch (error) {
    console.log('Error while extracting coordinates from HTML Method 3:', error);
    return null;
  }
}

async function extractCoordinatesFromHTMLMethod3(url) {
  try {
    var response = await fetch(url);
    var results = await gatherResponseText(response);
    console.log(results);
    console.log('second');
    let position = results.indexOf('https://www.google.com/maps/preview/place/'); // Now this is similar to the above use cases, we get the coordinates from an URI in the HTML code which starts with "https://www.google.com/maps/preview/place/"
    link = results.substring(position - 1, position + 250);
    var val = link.split('@')[1];
    console.log('testing');
    console.log(val, link);
    position = results.indexOf('https://maps.google.com/maps/api/staticmap?center='); // Again similar, we get the coordinates from an URI in the HTML code which starts with "https://maps.google.com/maps/api/staticmap?center="
    link = results.substring(position - 1, position + 250);
    console.log('link');
    var latlng = link.split('=')[1];
    lati = latlng.split('%2C')[0];
    lng = latlng.split('%2C')[1].split('&')[0];
    coordinates.latitude = lati;
    coordinates.longitude = lng;
    return coordinates;
  } catch (error) {
    console.log('Error while extracting coordinates from HTML Method 4:', error);
    return null;
  }
}
// Below are the simlar use cases with different search strings. The point of this being implemented is that there are some cases when only one URI is present in the backend which has the coordinates and we can't predict that so we have to check them one by one using try catch statements to avoid errors.
async function extractCoordinatesFromHTMLMethod4(url) {
  try {
    var response = await fetch(url);
    var results = await gatherResponseText(response);
    console.log('fourth');
    let position = results.indexOf('https://www.google.com/maps/place/');
    link = results.substring(position - 1, position + 250);
    console.log(link);
    var val = link.split('@')[1];
    console.log(val);
    lati = val.split(',')[0];
    lng = val.split(',')[1];
    coordinates.latitude = lati;
    coordinates.longitude = lng;
    return coordinates;
  } catch (error) {
    console.log('Error while extracting coordinates from HTML Method 5:', error);
    return null;
  }
}

async function extractCoordinatesFromHTMLMethod5(url) {
  try {
    var response = await fetch(url);
    var results = await gatherResponseText(response);
    console.log('fifth');
    let searchString = 'https://www.google.com/maps/search/';
    let position = searchString.length + results.indexOf('https://www.google.com/maps/search/');
    link = results.substring(position, position + 250);
    console.log(link);
    lati = link.split(',')[0];
    lng = link.split(',')[1].split('?')[0];
    coordinates.latitude = lati;
    coordinates.longitude = lng;
    return coordinates;
  } catch (error) {
    console.log('Error while extracting coordinates from HTML Method 6:', error);
    return null;
  }
}

export async function getCoordinates(request) {
  const extractionFunctions = [
    extractCoordinatesFromPlusCode,
    extractCoordinatesFromPlusCode2,
    extractCoordinatesFromHTMLMethod1,
    extractCoordinatesFromHTMLMethod2,
    extractCoordinatesFromHTMLMethod3,
    extractCoordinatesFromHTMLMethod4,
    extractCoordinatesFromHTMLMethod5,
  ];
  reqBody = null;
  lati = null;
  lng = null;
  urllen = request.query.url.length;
  string = '';
  for (const key in request.query) {
    if (request.query.hasOwnProperty(key) && key != 'url') {
      string = '%26' + key + request.query[key];
      request.query.url = encodeURI(request.query.url + string);
    }
  }
  request.query.url = decodeURITillSame(request.query.url);
  originalUrl = request.query.url;
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
        // Now this is out of pure observation that while sending too many requests over a small span of time, Google begins to mark those a activity, while sending the expanded URI with "&ucbcb=1" parameter along with it.
        url = decodeURIComponent(url);
        originalUrl = url;
      }
      if (urllen > url.length) {
        url = encodeURI(request.query.url);
      }
      reqBody = url;
      url = url.toString();
      url = encodeURI(url);
      urlObj = new URL(url);
      continueParam = urlObj.searchParams.get('continue'); // Sometimes while using the proxy and sending an request to the specific URI, it returns with https://www.google.com/sorry/index?continue={URI} , so this step becomes neccesary.
      if (continueParam) {
        url = decodeURITillSame(continueParam);
        url = decodeURIComponentTillSame(url);
        url = decodeURIComponent(url);
        originalUrl = url;
        reqBody = url;
      }
      let { pathname, host, hash, search } = new URL(url);

      array = url.split('/'); // Stores an array which contains parts of the url which are separated if they have an "/" between them. Example:- ""https://maps.google.com?q=VGR4+5MC+Falafel+M.+Sahyoun,+Beirut,+Lebanon&ftid=0x151f16e2123697fd:0x8e6626b678863990&hl=en-US&gl=tr&entry=gps&lucs=47067413&g_ep=CAISBjYuNjQuMxgAINeCAyoINDcwNjc0MTNCAlJV" is split into array whose array[arrLength-1] will be "maps.google.com?q=VGR4+5MC+Falafel+M.+Sahyoun,+Beirut,+Lebanon&ftid=0x151f16e2123697fd:0x8e6626b678863990&hl=en-US&gl=tr&entry=gps&lucs=47067413&g_ep=CAISBjYuNjQuMxgAINeCAyoINDcwNjc0MTNCAlJV" (in some URIs this part is even smaller) as you can see this part contains plus code and address in this specific use case which will be utilised further.
      arrLength = array.length;
      console.log('yes');
      // Iterate through each extraction function and attempt to extract coordinates
      for (const extractionFunction of extractionFunctions) {
        try {
          const coordinates = await extractionFunction(request.query.url);
          console.log(coordinates);
          if (coordinates) {
            // If coordinates are successfully extracted, update lati and lng
            lati = coordinates.latitude;
            lng = coordinates.longitude;
            lati = decodeURIComponent(decodeURIComponent(lati.toString())).trim();
            lng = decodeURIComponent(decodeURIComponent(lng.toString())).trim();
            console.log(lati, lng);
            if (lati.charAt(0) === '+') {
              // Sometimes coordinates are extracted as +24.678,89.909 or +23.546,-12.845. And in these type of coordinates a positive or negative sign accompanies them, while the negative sign seems to fit with the geo URI scheme (because of negative coordinates), the positive sign isn't so we have to remove the positive sign.
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

            const retBody = {
              url: ``,
              source: `${originalUrl}`,
              coordinates: ``,
            };
            retBody.coordinates = coordinates;
            retBody.url = reqDesc;
            json = JSON.stringify(retBody, null, 2);
            break;
          }
        } catch (error) {
          console.log(`Error while extracting coordinates: ${error.message}`);
        }
      }
    });
  return json;
}
