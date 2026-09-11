# Deployed visitor-IP header check

The offline tests inspect the `RequestInit` passed to `fetch`. They cannot observe
headers added by the hosting platform before a request reaches Google.
[Cloudflare documents](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip-in-worker-subrequests)
that Worker subrequests to non-Cloudflare customer zones carry the visitor's IP
in `CF-Connecting-IP` and `X-Real-IP`. A destination behind Cloudflare follows
different rules and is not an adequate substitute for this test.

This is an unverified deployment property, not a demonstrated leak from this
resolver. Do not infer IP anonymity from the application's fixed header set or
the offline header tests, and do not claim that deleting a header in application
code fixes platform injection without measuring the result.

## Required setup

- An isolated test Worker using the proposed deployment's compatibility date,
  flags, routes, and relevant account/zone settings.
- A controlled HTTPS origin whose DNS and ingress do not pass through Cloudflare.
  It must record the raw received headers, socket peer address, and request path
  before another proxy or framework rewrites them.
- Access to that origin's observations and the test client's public egress IPs.
  Keep raw IP addresses and credentials out of published test receipts.

## Procedure

1. Use the resolver's existing injectable `Fetch` seam in a test-only entry point.
   Rewrite only the destination URL to the fixed controlled origin, forwarding
   the resolver's `RequestInit` unchanged. Keep the production allowlist intact.
2. Begin resolution with a synthetic short link. Have the origin return a 302
   whose `Location` is an allowed Google embed URL with a synthetic CID. Map that
   second resolver request to another path on the controlled origin. Return a
   matching synthetic embed record there. Both hops must use the real resolver's
   outbound request construction.
3. Invoke the deployed test Worker from an external client. Include dummy
   cookie, authorization, and forwarding-header values, and compare the raw
   origin observations with the known client egress IPs and dummy values.
4. Inspect both hops for `CF-Connecting-IP`, `CF-Connecting-IPv6`, `X-Real-IP`,
   `X-Forwarded-For`, `True-Client-IP`, `Forwarded`, and any other header containing
   a client IP or supplied identifying value. Repeat for IPv4 and IPv6 when the
   deployment supports both.
5. Record the code revision, compatibility settings, network topology, header
   names, and redacted match/no-match results. A matching client IP fails the
   privacy requirement. A pass applies only to the tested deployment and paths;
   recheck after changing the hosting configuration or outbound transport.
6. Remove the test Worker and origin observations when finished. If the platform
   injects identifying headers, validate a transport or independently operated
   proxy that removes them before describing the service as IP-private.

No production privacy-verification result is recorded in this repository yet.
