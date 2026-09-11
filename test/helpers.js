const noFetch = () => {
  throw new Error('Unexpected network request');
};
const request = (url, path = '/coordinates') => new Request(`https://proxy.example${path}?${new URLSearchParams({ url })}`);
const redirect = (location, headers = {}) => new Response(null, { status: 302, headers: { Location: location, ...headers } });
const embed = (records) => `<script>initEmbed(${JSON.stringify(records)});</script>`;
const identity = '10963526813378500681';
const cidUrl = `https://maps.google.com/maps?cid=${identity}&output=embed`;

module.exports = { noFetch, request, redirect, embed, identity, cidUrl };
