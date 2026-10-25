# lcd-xvii.github.io

个人主页与 OI 文档的静态站点仓库，同时部署到 GitHub Pages 与 Cloudflare Workers。

- `/`：个人主页（`index.html`）
- `/oi-docs/`：OI 文档（由原 `lcd-xvii/oi-docs` 仓库迁移而来）
- `assets/css/app.css`：主页与文档共用的 rustdoc 风格样式
- `assets/css/home.css`：主页专用布局（无动画/过渡）

线上地址：

- <https://lcd-xvii.com/>
- <https://lcd-xvii.com/oi-docs/>
- <https://lcd-xvii.github.io/>
- <https://lcd-xvii.github.io/oi-docs/>

## 部署

推送到 `main` 后会并行触发两个工作流：

- `.github/workflows/deploy-pages.yml`：部署到 GitHub Pages。
- `.github/workflows/deploy-cloudflare.yml`：用 `wrangler` 部署同名 Worker 与静态资源到 Cloudflare，因此 GitHub 不可访问时 Cloudflare 站点仍可独立提供最新内容。

Cloudflare 工作流依赖仓库 Secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Workers 静态资源配置见 `wrangler.toml` 和 `.assetsignore`；`worker.mjs` 只负责将 `www.lcd-xvii.com` 301 到裸域，其余请求交给静态资源绑定。

## 文档索引

Markdown 变更时由 `.github/workflows/build-manifest.yml` 自动生成索引；部署工作流也会在发布前重新生成：

```sh
node .github/scripts/build-manifest.mjs
```
