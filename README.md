# lcd-xvii.github.io

个人主页与 OI 文档的静态站点仓库，同时部署到 GitHub Pages 与 Cloudflare Workers。

- `/`：个人主页（`index.html`）
- `/oi-docs/`：OI 文档（由原 `lcd-xvii/oi-docs` 仓库迁移而来）
- `assets/css/tokens.css`：设计系统 token（暖米白 × 赤陶 × 无衬线，单浅色主题），主页与文档页共用
- `assets/css/home.css`：主页样式（GitHub 式两栏：左侧身份与联系，右侧入口卡片 + 贡献墙 + 最近）
- `assets/css/app.css`：`/oi-docs` 界面样式（依赖 `tokens.css`）
- `assets/js/home.js`：主页的「最近 / 贡献墙」，按 `SOURCES` 声明式取数据；加一个来源就能多一类条目
- `design/`：设计过程与预览（`ui-direction.md`、`preview*.html`、`draft/` 上一版衬线草稿、`shots/`），不参与站点导航

设计约定：正文 Inter、代码 Roboto Mono（仅此两族）；字号四级（30 / 20 / 18 / 15，文档导航 16）；
版式参考 GitHub 个人主页：容器 1280、左栏 296、头像 260、贡献墙 12px 方格 / 2px 间距；
一种强调色（赤陶，只给链接悬停、标签、小面积高亮）；1px 线分层；零渐变、页面内零阴影；单浅色主题。

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

Markdown 变更时由 `.github/workflows/build-manifest.yml` 自动生成索引；部署工作流也会在发布前重新生成。
生成的 `manifest.json` 里每篇文档带 `updated`（最后一次提交日期，来自 `git log`），主页的
「最近」与「贡献墙」就读这个字段——因此工作流里 checkout 需要 `fetch-depth: 0`：

```sh
node .github/scripts/build-manifest.mjs
```
