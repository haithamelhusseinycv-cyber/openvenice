const VENICE_APP = 'https://venice.grokbot.download';
const AUTH_ROUTES = new Set(['status', 'consume', 'logout']);
export async function handleVeniceSession(request, fetchUpstream = fetch) {
  const url = new URL(request.url);
  const auth = url.pathname.startsWith('/venice-auth/');
  const api = url.pathname.startsWith('/api/venice/');
  if (!auth && !api) return null;
  if (auth && !AUTH_ROUTES.has(url.pathname.slice('/venice-auth/'.length)))
    return new Response('Not found', { status: 404 });
  if (!['GET', 'POST', 'DELETE'].includes(request.method))
    return new Response('Method not allowed', { status: 405 });
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin)
    return new Response('Forbidden', { status: 403 });
  const path = auth ? '/auth/' + url.pathname.slice('/venice-auth/'.length) : url.pathname;
  const headers = new Headers();
  for (const name of ['cookie', 'content-type', 'accept']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (origin) headers.set('Origin', VENICE_APP);
  const response = await fetchUpstream(VENICE_APP + path + url.search, {
    method: request.method, headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  });
  const out = new Headers(response.headers);
  out.set('Cache-Control', 'no-store');
  out.delete('Access-Control-Allow-Origin');
  const location = out.get('Location');
  if (location) {
    const target = new URL(location, VENICE_APP);
    if (target.origin !== VENICE_APP) return new Response('Invalid redirect', { status: 502 });
    out.set('Location', target.pathname + target.search);
  }
  return new Response(response.body, { status: response.status, headers: out });
}
