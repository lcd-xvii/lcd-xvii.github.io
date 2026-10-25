const CANONICAL_HOST = 'lcd-xvii.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // www 统一跳转到裸域，保留路径与查询参数。
    if (url.hostname === `www.${CANONICAL_HOST}`) {
      url.hostname = CANONICAL_HOST;
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    return env.ASSETS.fetch(request);
  },
};
