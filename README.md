# url-privacy-proxy
Extracts coordinates from google-encoded urls without exposing clients' IP addresses

URIs like https://maps.app.goo.gl/Ce7zkj2X8oUy3Se49?g_st=ic are unshortened and coordinates are extracted and then coverted to geo URIs.


[![Deploy master to Production](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/organicmaps/url-privacy-proxy)

## Requirements

Install CloudFlare's wrangler and other dev dependencies using npm:

```bash
npm i
```

## Development

Use `npx wrangler dev` for development using Cloudflare, or `npx wrangler dev --local` for localhost development.