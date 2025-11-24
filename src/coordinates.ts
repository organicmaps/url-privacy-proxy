import { IRequest } from 'itty-router';

import * as cheerio from 'cheerio';

// Sometimes while using the proxy and sending a request to the specific URI, it returns with
// https://www.google.com/sorry/index?continue={URI} , so we store 'continue' parameter.
let continueParam;
let originalUrl;
let urllen;
let link;

interface Coords {
  latitude: string | null;
  longitude: string | null;
}

function decodeURITillSame(uri: string): string {
  let decodedURI = decodeURI(uri);
  while (decodedURI !== uri) {
    uri = decodedURI;
    decodedURI = decodeURI(uri);
  }

  function decodeURIComponentTillSame(uri: string): string {
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

function getCityStateFromAddress(address: string): string {
  var parts = address.split(',');
  var num_parts = parts.length;
  if (num_parts >= 2) return parts[num_parts - 2].trim() + ', ' + parts[num_parts - 1];
  else return address;
}

function extractPlusCode(address: string): string | null {
  let result = /[A-Z0-9]{4}\+[A-Z0-9]{2}[A-Z0-9]?/.exec(address);
  if (result !== null) return result[0];
  else return null;
}

function decodeURIComponentTillSame(uri: string): string {
  // This function is often called in the code flow because sometimes Google throws highly encoded URIs.
  let decodedURI = decodeURIComponent(uri);
  while (decodedURI !== uri) {
    uri = decodedURI;
    decodedURI = decodeURIComponent(uri);
  }
  return decodedURI;
}

async function extractCoordinatesFromPlusCode(url: string) {
  // Implementation of extracting coordinates from Plus Codes
  // Return an object { latitude, longitude } if successful, otherwise null
  try {
    //console.log(url);
    //console.log(array);
    //console.log(arrLength);
    let urlObj = new URL(url);
    // Gets the 'q' param from the above mentioned part of URL and then splits them apart into plus code and address
    const qParam = urlObj.searchParams.get('q');
    console.log(`qParam = ${qParam}`);
    if (qParam === null) {
      console.warn(`extractCoordinatesFromPlusCode: no 'q' parameter in URL`);
      return null;
    }
    var address: string = qParam;
    address = decodeURIComponentTillSame(address);
    console.log(`address = ${address}`);
    let plus_code = extractPlusCode(address);
    if (plus_code === null) {
      console.warn(`extractCoordinatesFromPlusCode: can't find plus code in '${address}'`);
      return null;
    }
    // Now store the city and state/province of which the address is of.
    var cityandState: string = getCityStateFromAddress(address);
    console.log(`cityandState = ${cityandState}`);
    // Make an API request to retrieve the center of the city.
    const response: Response = await fetch(`https://geocode.maps.co/search?q=${cityandState}&api_key=6920347d26971281068353khod666ae`);
    const results: any = await response.json();
    //console.log(cityandState);
    //console.log(response);
    if (results.length == 0) {
      console.warn(`extractCoordinatesFromPlusCode2: geocode.maps.co responded with 0 results`);
      return null;
    }

    var lat = results[0].lat;
    var lon = results[0].lon;
    // Utilises the latitude and longitude to retrieve the plus codes of the center of the city.
    const res = await fetch(`https://plus.codes/api?address=${lat},${lon}&email=kartikaysaxena12@gmail.com`);
    const result: any = await res.json();
    var global_code = result.plus_code.global_code;
    console.log(`global_code = ${global_code}`);
    // Prepares the plus code from the city center plus code and plus code in the URI and then retrieve
    // the location coordinates from the prepared plus code.
    var pc_final = global_code.substring(0, 4) + plus_code.replace('+', '%2B');
    //console.log(`Query API: 'https://plus.codes/api?address=${pc_final}'`);
    const api = await fetch(`https://plus.codes/api?address=${pc_final}`);
    const final: any = await api.json();
    //console.log(final)
    lat = final.plus_code.geometry.location.lat;
    lon = final.plus_code.geometry.location.lng;

    return {
      latitude: lat,
      longitude: lon,
    };
  } catch (error) {
    console.log('Error while extracting coordinates from Plus Codes:', error);
    return null;
  }
}

async function extractCoordinatesFromPlusCode2(url: string) {
  try {
    var response = await fetch(url);
    var results_raw: string = await response.text(); // results contains the HTML code.
    const $ = cheerio.load(results_raw); // It loads the HTML code via the library which we can further access like an object.
    let address = $('[itemprop="name"]').attr('content'); // The address is stored in this. Next the same procedure is followed just like in the above use case.
    console.log(`address = ${address}`);
    if (address === null || address === undefined) {
      return null;
    }
    let plucodeAddress = address.split('·')[1].trim();
    let plusCode = extractPlusCode(plucodeAddress);
    if (plusCode === null) {
      console.warn(`extractCoordinatesFromPlusCode2: address doesn't contain plus code '${address}'`);
      return null;
    }
    console.log(`plusCode = ${plusCode}`);
    link = plucodeAddress;
    var cityandState = link.split(',')[link.split(',').length - 3] + link.split(',')[link.split(',').length - 2];
    console.log(`cityandState = ${cityandState}`);
    response = await fetch(`https://geocode.maps.co/search?q=${cityandState}&api_key=6920347d26971281068353khod666ae`);
    results_raw = await response.text();
    if (response.status >= 400) {
      console.warn(`extractCoordinatesFromPlusCode2: server responded with error ${response.status}\n${results_raw}`);
      return null;
    }
    //console.log(results_raw);
    let results: any = JSON.parse(results_raw);
    if (results.length == 0) {
      console.warn(`extractCoordinatesFromPlusCode2: geocode.maps.co responded with 0 results`);
      return null;
    }
    var lat = results[0].lat;
    var lon = results[0].lon;
    console.log(lat);
    console.log(lon);
    const res = await fetch(`https://plus.codes/api?address=${lat},${lon}&email=kartikaysaxena12@gmail.com`);
    let raw_result: string = await res.text();
    let result: any = JSON.parse(raw_result);
    console.log(global_code);
    var global_code = result.plus_code.global_code;
    console.log(global_code);
    var pc_final = global_code.substring(0, 4) + plusCode; //.substring(0, plusCode.length);
    console.log(plusCode);
    console.log(pc_final);
    let api = await fetch(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`);
    console.log(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`);
    let final_response_raw: string = await api.text();
    let final_response: any = JSON.parse(final_response_raw);
    lat = final_response.plus_code.geometry.location.lat;
    lon = final_response.plus_code.geometry.location.lng;
    return {
      latitude: lat,
      longitude: lon,
    };
  } catch (error) {
    console.log('Error while extracting coordinates from HTML Method 1:', error);
    return null;
  }
}

async function extractCoordinatesFromHTMLMethod1(url: string): Promise<Coords | null> {
  try {
    var response = await fetch(url);
    var results = await response.text();
    //console.log(results);
    var position = results.indexOf(';markers'); // Gets the index of ;markers in the code.
    if (position == -1) {
      console.warn(`extractCoordinatesFromHTMLMethod1: can't find ';markers' in HTML response`);
      return null;
    }
    var link = results.substring(position - 1, position + 70); // extracts the string nearby it
    link = link.split('=')[1]; // Gets the latitude and longitude from it
    let lat = link.split('%2C')[0];
    let lng = link.split('%2C')[1].split('%7C')[0];

    return {
      latitude: lat,
      longitude: lng,
    };
  } catch (error) {
    console.log('Error while extracting coordinates from HTML Method 2:', error);
    return null;
  }
}

async function extractCoordinatesFromHTMLMethod2(url: string): Promise<Coords | null> {
  try {
    var response = await fetch(url);
    var results = await response.text();
    console.log(results);
    //console.log('second');
    let position = results.indexOf('https://www.google.com/maps/preview/place/');
    if (position == -1) {
      console.warn(`extractCoordinatesFromHTMLMethod2: can't find 'https://www.google.com/maps/preview/place/' in HTML output`);
      return null;
    }
    link = results.substring(position - 1, position + 250);
    var val = link.split('@')[1];
    console.log('testing');
    console.log(val, link);
    let lat = val.split(',')[0];
    let lon = val.split(',')[1];
    return {
      latitude: lat,
      longitude: lon,
    };
  } catch (error) {
    console.log('Error while extracting coordinates from HTML Method 3:', error);
    return null;
  }
}

async function extractCoordinatesFromHTMLMethod3(url: string): Promise<Coords | null> {
  try {
    var response = await fetch(url);
    var results = await response.text();
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
    let lat = latlng.split('%2C')[0];
    let lon = latlng.split('%2C')[1].split('&')[0];
    return {
      latitude: lat,
      longitude: lon,
    };
  } catch (error) {
    console.log('Error while extracting coordinates from HTML Method 4:', error);
    return null;
  }
}
// Below are the simlar use cases with different search strings. The point of this being implemented is that there are some cases when only one URI is present in the backend which has the coordinates and we can't predict that so we have to check them one by one using try catch statements to avoid errors.
async function extractCoordinatesFromHTMLMethod4(url: string): Promise<Coords | null> {
  try {
    var response = await fetch(url);
    var results = await response.text();
    console.log('fourth');
    let position = results.indexOf('https://www.google.com/maps/place/');
    link = results.substring(position - 1, position + 250);
    console.log(link);
    var coords = link.split('@')[1];
    console.log(coords);
    let lat = coords.split(',')[0];
    let lon = coords.split(',')[1];
    return {
      latitude: lat,
      longitude: lon,
    };
  } catch (error) {
    console.log('Error while extracting coordinates from HTML Method 5:', error);
    return null;
  }
}

async function extractCoordinatesFromHTMLMethod5(url: string): Promise<Coords | null> {
  try {
    var response = await fetch(url);
    var results = await response.text();
    console.log('fifth');
    let searchString = 'https://www.google.com/maps/search/';
    let position = searchString.length + results.indexOf('https://www.google.com/maps/search/');
    link = results.substring(position, position + 250);
    console.log(link);
    let lat = link.split(',')[0];
    let lon = link.split(',')[1].split('?')[0];
    return {
      latitude: lat,
      longitude: lon,
    };
  } catch (error) {
    console.log('Error while extracting coordinates from HTML Method 6:', error);
    return null;
  }
}

export async function getCoordinates(request: IRequest) {
  const extractionFunctions: ((url: string) => Promise<null | Coords>)[] = [
    extractCoordinatesFromPlusCode,
    extractCoordinatesFromPlusCode2,
    extractCoordinatesFromHTMLMethod1,
    extractCoordinatesFromHTMLMethod2,
    //extractCoordinatesFromHTMLMethod3,
    //extractCoordinatesFromHTMLMethod4,
    //extractCoordinatesFromHTMLMethod5,
  ];
  let response_json: string | null = null;
  let lat = null;
  let lng = null;
  urllen = request.query.url.length;
  //string = '';
  request.query.url = decodeURITillSame(request.query.url);
  originalUrl = request.query.url;
  const resp = await fetch(request.query.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0',
      'Accept-Language': 'en;q=0.8',
      DNT: '1',
    },
  });
  var url = resp.url;

  if (url.endsWith('ucbcb=1')) {
    // Now this is out of pure observation that while sending too many requests over a small span of time, Google begins to mark those a activity, while sending the expanded URI with "&ucbcb=1" parameter along with it.
    url = decodeURIComponent(url);
    originalUrl = url;
  }
  if (urllen > url.length) {
    url = encodeURI(request.query.url);
  }
  url = url.toString();
  url = encodeURI(url);
  let urlObj = new URL(url);
  continueParam = urlObj.searchParams.get('continue'); // Sometimes while using the proxy and sending an request to the specific URI, it returns with https://www.google.com/sorry/index?continue={URI} , so this step becomes neccesary.
  if (continueParam) {
    url = decodeURITillSame(continueParam);
    url = decodeURIComponentTillSame(url);
    url = decodeURIComponent(url);
    originalUrl = url;
  }
  let { pathname, host, hash, search } = new URL(url);

  // Iterate through each extraction function and attempt to extract coordinates
  for (const extractionFunction of extractionFunctions) {
    try {
      const coordinates: Coords | null = await extractionFunction(request.query.url);
      //console.log(coordinates);
      if (coordinates) {
        // If coordinates are successfully extracted, update lat and lng
        lat = coordinates.latitude || '';
        lng = coordinates.longitude || '';
        lat = decodeURIComponent(decodeURIComponent(lat.toString())).trim();
        lng = decodeURIComponent(decodeURIComponent(lng.toString())).trim();
        console.log(lat, lng);
        if (lat.charAt(0) === '+') {
          // Sometimes coordinates are extracted as +24.678,89.909 or +23.546,-12.845.
          // And in these type of coordinates a positive or negative sign accompanies them,
          // while the negative sign seems to fit with the geo URI scheme (because of negative
          // coordinates), the positive sign isn't so we have to remove the positive sign.
          lat = lat.substring(1);
        }
        if (lng.charAt(0) === '+') {
          lng = lng.substring(1);
        }
        lat = parseFloat(lat);
        lng = parseFloat(lng);

        const respBody: any = {
          url: {
            geo: `geo:${lat},${lng}`,
            openstreetmap: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}`,
          },
          source: `${originalUrl}`,
          coordinates: coordinates,
        };
        response_json = JSON.stringify(respBody, null, 2);
        break;
      }
    } catch (error: any) {
      console.log(`Error while extracting coordinates: ${error.message}`);
    }
  }
  return response_json;
}
