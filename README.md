# lcd-xvii.github.io

个人主页与 OI 文档的静态站点仓库，由 GitHub Pages 部署。

- `/`：个人主页（`index.html`）
- `/oi-docs/`：OI 文档（由原 `lcd-xvii/oi-docs` 仓库迁移而来）

线上地址：

- <https://lcd-xvii.com/>
- <https://lcd-xvii.com/oi-docs/>
- <https://lcd-xvii.github.io/>
- <https://lcd-xvii.github.io/oi-docs/>

文档索引由 `.github/workflows/build-manifest.yml` 在 Markdown 变更时自动生成：

```sh
node .github/scripts/build-manifest.mjs
```
