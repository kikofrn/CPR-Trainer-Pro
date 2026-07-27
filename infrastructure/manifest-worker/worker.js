export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/manifest') {
      return new Response('Not found', { status: 404 });
    }
    const files = [];
    let cursor;
    do {
      const list = await env.MEDIA_BUCKET.list({ cursor, limit: 1000 });
      for (const o of list.objects) {
        files.push({ key: o.key, etag: o.etag, uploaded: o.uploaded, size: o.size });
      }
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);
    return new Response(
      JSON.stringify({ generated: new Date().toISOString(), files }),
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=60',
          'access-control-allow-origin': '*'
        }
      }
    );
  }
};
