# OI 文档

静态 OI 文档站点，部署在 GitHub Pages。页面从站点同源索引读取 Markdown 文档，并提供多关键词全文搜索、分类与标签筛选、文内目录、代码高亮和公式渲染。

当前仓库为 `lcd-xvii/lcd-xvii.github.io`，本文档站位于仓库的 `oi-docs/` 子目录，线上路径为：

- <https://lcd-xvii.com/oi-docs/>
- <https://lcd-xvii.github.io/oi-docs/>

## 项目结构

- `index.html`：中文页面骨架与主题预载。
- `assets/css/app.css`：Rust 文档风格的布局、主题和响应式样式。
- `assets/js/app.js`：文档索引、路由、搜索与页面交互。
- `assets/js/keybindings.js`：快捷键配置及帮助页展示所用的统一定义。
- `assets/js/markdown.js`：Markdown、KaTeX 和代码高亮配置。
- `assets/js/storage.js`：文档和索引的 IndexedDB 缓存。

顶部主搜索支持按标题或正文筛选、短语匹配和键盘选取结果。快捷键集中配置在 `assets/js/keybindings.js`，帮助页会读取同一份配置；支持侧栏、设置、帮助、目录、搜索、文件切换、主题/字号/页宽调整、同步和滚动控制。文件切换会打开仅按标题筛选的搜索框。

页面设置支持浅色、深色和 Ayu 主题，字体、字号、每行文字宽度、代码换行和侧栏宽度会保存在当前浏览器中。

## 本地预览

在仓库根目录启动静态 HTTP 服务后访问 `http://localhost:8000/oi-docs/`：

```sh
python3 -m http.server 8000
```

请通过 HTTP(S) 访问页面；直接以 `file://` 打开会阻止浏览器加载 ES 模块。
