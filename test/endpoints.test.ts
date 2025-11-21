import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("url-privacy-proxy worker", () => {
  it("responds with not found and proper status for /", async () => {
    const response = await SELF.fetch("http://example.com/");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe(JSON.stringify({"error":"Unknown endpoint"}));
  });

  it("convert urls to coordinates", async () => {
    const testUrls = [
      ['https://maps.google.com/?q=4M6J%2BVFW, Frankfurt am Main, Germany', 50.1122375, 8.6786282],
      ['https://maps.app.goo.gl/ZLcuEvpc2zLow752A?g_st=ic', 47.3842845, 8.5744797],
      ['https://maps.app.goo.gl/QPhWppAvmRaZnPSTA?g_st=ic', 28.3872652, 79.4301254],
      ['https://goo.gl/maps/DGMfrX4rZqeWCtv89?coh=178572&entry=tt', 47.371461, 8.543614],
      ['https://goo.gl/maps/Suj2A4m4BVkRR69S8', 28.390487500000006, 79.435796875],
      ['https://goo.gl/maps/sXnse1erRvkA6aV99', 33.8904447, 35.5066505],
      ['https://maps.app.goo.gl/JCoheE7WbWbAxSkY8?g_st=ic', 28.3924375, 79.43151562499997],
      ['https://goo.gl/maps/L2VaCu56rYSMgRVEA', 28.3840209, 79.4323196],
      ['https://maps.app.goo.gl/9ivZQ71CKMqRPDtQA', 41.0102214, 28.9739212],
      ['https://goo.gl/maps/3qq8ft64MRUWxjxG6', 40.648425, -100.822401],
      ['https://goo.gl/maps/Dyck9mYMKEoVzhJ18', 28.385307, 79.438022],
      ['https://goo.gl/maps/TZjyL4yiFh5XykYR7', 28.4051028, 79.448115],
      ['https://goo.gl/maps/tKZf9gcTgyuQQ2vH6', 27.1751448, 78.0421422],
      ['https://goo.gl/maps/GqmBWG2TmzNWiJSh6', 26.792162500000014, 82.19989062499997],
    ];

    for (var [inputUrl, expectedLat, expectedLon] of testUrls) {
      console.log(`Decoding URL '${inputUrl}'`);
      const response = await SELF.fetch(`http://example.com/coordinates?url=${inputUrl}`);
      let response_json = await response.json();
      console.log("response = ", response_json)
      let coordinates = response_json.coordinates;
      expect(coordinates.latitude).toBeCloseTo(expectedLat, 2);
      expect(coordinates.longitude).toBeCloseTo(expectedLon, 2);
    }

  })
});
