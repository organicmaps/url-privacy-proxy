import {Router,Request} from 'itty-router'
import * as cheerio from 'cheerio';
const router = Router()
async function getCoordinates(request) {
    async function gatherResponse(response) {
        const {
            headers
        } = response;
        return response.json();
    }
    const init = {
        headers: {
            "content-type": "application/json;charset=UTF-8",
        },
    };
    var reqBody = null
    var lati = null
    var lng = null
    var urllen = request.query.url.length
    var string = ''
    for (const key in request.query) {
        if (request.query.hasOwnProperty(key) && key != 'url') {
            string = '%26' + key + request.query[key]
            request.query.url = encodeURI(request.query.url + string)
        }
    }
    var flag = 0
    var originalUrl = request.query.url
    var ol = request.query.url
    await fetch(request.query.url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0",
                "Accept-Language": "en;q=0.8",
                "DNT": "1",
            }
        })
        .then((value1) => {
            return value1
        }).then(async (value2) => {
            var url = value2.url
            if (url.endsWith("ucbcb=1")) {
                url = decodeURIComponent(url)
                originalUrl = url
            }
            if (urllen > url.length) {
                url = encodeURI(request.query.url)
            }
            reqBody = url
            url = url.toString()
            url = encodeURI(url)
            const urlObj = new URL(url);
            const continueParam = urlObj.searchParams.get("continue");
            if (continueParam) {
                flag = 1
                url = decodeURIComponent(continueParam)
                originalUrl = decodeURIComponent(continueParam)
                reqBody = url
            } else {}
            var {
                pathname,
                host,
                hash,
                search
            } = new URL(url)
            var newUrl = pathname
            const array = newUrl.split('/')
            if (host === 'www.google.com' || host === 'maps.google.com') {
                const path = pathname + search + hash
                reqBody = url
                if (path.startsWith('/maps?daddr=') || path.startsWith('/maps?saddr=')) {
                    var address = path.split('=')[1]
                    var link = 'om://search?query=' + address
                    const regex = /\+/ig
                    var ad = address
                } else if (path.startsWith('/maps?q=loc:')) {
                    var coord = path.split(':')[1]
                    var link = 'geo:' + coord
                    lati = coord.split(',')[0]
                    lng = coord.split(',')[1]
                    reqBody = link
                } else if (path.startsWith('/maps?ll=')) {
                    var coord = path.split('=')[1]
                    lati = coord.split(',')[0]
                    lng = coord.split(',')[1]
                    var link = 'geo:' + coord
                    reqBody = link
                } else if (path.startsWith('/maps?q=') || (path.startsWith('/search?q=')) || (path.startsWith('/maps/place/?q'))) {
                    var address = path.split('=')[1]
                    var link = address
                    const regex = /\+/ig
                    var ad = link
                } else if (path.startsWith('/maps/search/?q=')) {
                    var address = path.split('=')
                    var link = address[address.length - 1]
                    const regex = /\+/ig
                    var ad = link
                } else if (path.startsWith('/maps/search/')) {
                    var address = path.split('/')
                    if (address[address.length - 1].charAt(0) === '@') {
                        address[address.length - 1] = address[address.length - 1].substring(1)
                    }
                    var link = address[address.length - 1]
                    link = link.split('?')[0]
                    if (link.split(',').length>1){
                       lati =  link.split(',')[0]
                       lng =  link.split(',')[1]
                    }
                    const regex = /\+/ig
                    var ad = link
                } else if (path.startsWith('/maps/dir/')) {
                    var address = path.split('/')
                    var link = address[address.length - 1]
                    const regex = /\+/ig
                    var ad = link
                } else if (path.startsWith('/maps/place')) {
                    try {
                        if (array[4].charAt(0) === '@') {
                            try {
                                async function gatherResponse(response) {
                                    return response.text();
                                }
                                const response = await fetch(ol)
                                const results = await gatherResponse(response);
                                var pos = results.indexOf('https://www.google.com/maps/preview/place/')
                                var link = results.substring(pos - 1, pos + 250)
                                var val = link.split('@')[1]
                                var lat = val.split(',')[0]
                                var lon = val.split(',')[1]
                                const $ = cheerio.load(results);
                                let address = $('[itemprop="name"]').attr('content')
                                var plus_code = address
                                try {
                                    plus_code = address.split('·')[1].trim()
                                } catch {
                                    plus_code = address
                                }
                                if (plus_code.at(4) == '+') {
                                    var pc = plus_code.split(',')[0]
                                    var addlen = plus_code.split(',').length
                                    var add = plus_code.split(',')[addlen - 2] + plus_code.split(',')[addlen - 1]
                                    try {
                                        add = plus_code.split(',')[addlen - 3] + plus_code.split(',')[addlen - 2]
                                    } catch {
                                        add = plus_code.split(',')[addlen - 2] + plus_code.split(',')[addlen - 1]
                                    }
                                    async function gatherResponse(response) {
                                        return response.json();
                                    }
                                    const response = await fetch(`https://geocode.maps.co/search?q=${add}`)
                                    const results = await gatherResponse(response);
                                    var lat = results[0].lat
                                    var lon = results[0].lon
                                    const res = await fetch(`https://plus.codes/api?address=${lat},${lon}&email=kartikaysaxena12@gmail.com`)
                                    const result = await gatherResponse(res);
                                    var global_code = result.plus_code.global_code
                                    var pc_final = global_code.substring(0, 4) + pc.substring(0, 7)
                                    pc_final = pc_final.substring(0, 8) + '%2B' + pc_final.substring(9, 11)
                                    const api = await fetch(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`)
                                    const final = await gatherResponse(api)
                                    lati = final.plus_code.geometry.location.lat
                                    lng = final.plus_code.geometry.location.lng
                                    reqBody = `geo:${lati},${lng}`
                                } else {
                                    lati = lat
                                    lng = lon
                                    reqBody = `geo:${lati},${lng}`
                                }
                            } catch {
                                lati = array[3].split(',')[0]
                                lng = array[3].split(',')[1]
                                reqBody = link
                            }
                        } else {
                            var address = array[3]
                            reqDesc = 'Address'
                            const regex = /\+/ig
                            var ad = address
                        }
                    } catch {
                        var address = array[3]
                        const regex = /\+/ig
                        var ad = address
                    }
                } else {
                    try {
                        const coord = path.split('@')
                        if (coord.length === 1) {
                            throw false
                        }
                        const geo = 'geo:' + coord[coord.length - 1]
                        lati = coord[coord.length - 1].split(',')[0]
                        lng = coord[coord.length - 1].split(',')[1]
                        reqBody = geo
                    } catch {
                        var address = array[array.length - 2]
                        const regex = /\+/ig
                        var ad = address
                    }
                }
                if (reqBody === url) {
                    if (ad.split('+')[0].length == 4) {
                        var pc = ad.split('&')[0]
                        var len = pc.split(',').length
                        try {
                            var country = pc.split(',')[len - 1]
                            var city = pc.split(',')[len - 2]
                            if (country.charAt(0) == '+') {
                                let len = country.length
                                country = country.substring(1, len)
                            }
                            if (city.charAt(0) == '+') {
                                let len = city.length
                                city = city.substring(1, len)
                            }
                            country = decodeURIComponent(country)
                            city = decodeURIComponent(city)
                            async function gatherResponse(response) {
                                return response.json();
                            }
                            const response = await fetch(`https://geocode.maps.co/search?city=${city}&country=${country}`)
                            const results = await gatherResponse(response);
                            var lat = results[0].lat
                            var lon = results[0].lon
                            const res = await fetch(`https://plus.codes/api?address=${lat},${lon}&email=kartikaysaxena12@gmail.com`)
                            const result = await gatherResponse(res);
                            var global_code = result.plus_code.global_code
                            var pc_final = global_code.substring(0, 4) + ad.substring(0, 7)
                            pc_final = pc_final.substring(0, 8) + '%2B' + pc_final.substring(9, 11)
                            const api = await fetch(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`)
                            const final = await gatherResponse(api)
                            lati = final.plus_code.geometry.location.lat
                            lng = final.plus_code.geometry.location.lng
                            reqBody = `geo:${lati},${lng}`
                        } catch {
                            async function gatherResponse(response) {
                                return response.json();
                            }
                            var plus_code = ad
                            var addlen = plus_code.split(',').length
                            var add = plus_code.split(',')[addlen - 2] + plus_code.split(',')[addlen - 1].split('&')[0]
                            const regex = /\+/ig
                            add = add.replace(regex, " ")
                            const response = await fetch(`https://geocode.maps.co/search?q=${add}`)
                            const results = await gatherResponse(response);
                            var lat = results[0].lat
                            var lon = results[0].lon
                            const res = await fetch(`https://plus.codes/api?address=${lat},${lon}&email=kartikaysaxena12@gmail.com`)
                            const result = await gatherResponse(res);
                            var global_code = result.plus_code.global_code
                            var pc_final = global_code.substring(0, 4) + ad.substring(0, 7)
                            pc_final = pc_final.substring(0, 8) + '%2B' + pc_final.substring(9, 11)
                            const api = await fetch(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`)
                            const final = await gatherResponse(api)
                            lati = final.plus_code.geometry.location.lat
                            lng = final.plus_code.geometry.location.lng
                            reqBody = `geo:${lati},${lng}`
                        }
                    } else if (ad.split(',').length == 2) {
                        reqBody = `geo:${ad}`
                    } else {
                        async function gatherResponse(response) {
                            return response.text();
                        }
                        const response = await fetch(url)
                        const results = await gatherResponse(response);
                        var pos = results.indexOf('https://www.google.com/maps/preview/place/')
                        var link = results.substring(pos - 1, pos + 250)
                        var val = link.split('@')[1]
                        var lat = val.split(',')[0]
                        var lon = val.split(',')[1]
                        const $ = cheerio.load(results);
                        let address = $('[itemprop="name"]').attr('content')
                        var plus_code = address
                        try {
                            plus_code = address.split('·')[1].trim()
                        } catch {
                            plus_code = address + '&ucbcb'
                        }
                        if (plus_code.at(4) == '+') {
                            var pc = plus_code.split(',')[0]
                            var addlen = plus_code.split(',').length
                            var add = plus_code.split(',')[addlen - 2] + plus_code.split(',')[addlen - 1]
                            try {
                                add = plus_code.split(',')[addlen - 3] + plus_code.split(',')[addlen - 2]
                            } catch {
                                add = plus_code.split(',')[addlen - 2] + plus_code.split(',')[addlen - 1]
                            }
                            async function gatherResponse(response) {
                                return response.json();
                            }
                            const response = await fetch(`https://geocode.maps.co/search?q=${add}`)
                            const results = await gatherResponse(response);
                            var lat = results[0].lat
                            var lon = results[0].lon
                            const res = await fetch(`https://plus.codes/api?address=${lat},${lon}&email=kartikaysaxena12@gmail.com`)
                            const result = await gatherResponse(res);
                            var global_code = result.plus_code.global_code
                            var pc_final = global_code.substring(0, 4) + pc.substring(0, 7)
                            pc_final = pc_final.substring(0, 8) + '%2B' + pc_final.substring(9, 11)
                            const api = await fetch(`https://plus.codes/api?address=${pc_final}&email=kartikaysaxena12@gmail.com`)
                            const final = await gatherResponse(api)
                            lati = final.plus_code.geometry.location.lat
                            lng = final.plus_code.geometry.location.lng
                            reqBody = `geo:${lati},${lng}`
                        } else {
                            lati = lat
                            lng = lon
                            reqBody = `geo:${lati},${lng}`
                        }
                    }
                }
            }
        })
    lati = decodeURIComponent(decodeURIComponent(lati.toString())).trim()
    lng = decodeURIComponent(decodeURIComponent(lng.toString())).trim() 
    if (lati.charAt(0)==='+') {
        lati = lati.substring(1)
    }
    if (lng.charAt(0)==='+') {
        lng = lng.substring(1)
    }
    lati = parseFloat(lati)
    lng = parseFloat(lng)
    reqBody = `geo:${lati},${lng}`
    var reqDesc = {
        geo: `${reqBody}`,
        openstreetmap: `https://www.openstreetmap.org/?mlat=${lati}&mlon=${lng}`
    }
    var coordinates = {
        latitude: lati,
        longitude: lng
    }
    const retBody = {
        url: ``,
        source: `${originalUrl}`,
        coordinates: ``
    }
    retBody.coordinates = coordinates
    retBody.url = reqDesc
    const json = JSON.stringify(retBody, null, 2);
    return json
}
router.get('/search', async request => {
    var json = await getCoordinates(request)
    return new Response(json, {
        headers: {
            "content-type": "application/json;charset=UTF-8",
        },
    });
})
router.get('/redirect', async request => {
        var json = await getCoordinates(request)
        json = JSON.parse(json)
        var link = json.url.geo
        return Response.redirect(link)
    })
    .get('*', (request: Request) => {
        return new Response(
            JSON.stringify({
                error: 'hey'
            })
        )
    })
export function handleRequest(request: Request) {
    return router.handle(request)
}