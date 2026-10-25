const CANONICAL_HOST = 'lcd-xvii.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 统一 HTTPS，并把 www 跳转到裸域，保留路径与查询参数。
    const isHttp = url.protocol === 'http:';
    const isWww = url.hostname === `www.${CANONICAL_HOST}`;

    if (isHttp || isWww) {
      url.protocol = 'https:';
      if (isWww) url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    return env.ASSETS.fetch(request);
  },
};
