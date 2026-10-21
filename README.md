# OI 文档

静态 OI 文档站点，部署在 GitHub Pages。页面从站点同源索引读取 Markdown 文档，并提供全文搜索、分类与标签筛选、文内目录、代码高亮和公式渲染。

## 项目结构

- `index.html`：中文页面骨架与主题预载。
- `assets/css/app.css`：Rust 文档风格的布局、主题和响应式样式。
- `assets/js/app.js`：文档索引、路由、搜索与页面交互。
- `assets/js/markdown.js`：Markdown、KaTeX 和代码高亮配置。
- `assets/js/storage.js`：文档和索引的 IndexedDB 缓存。

页面设置支持浅色、深色和 Ayu 主题，字体、字号、正文宽度、代码换行和侧栏宽度会保存在当前浏览器中。

## 本地预览

在仓库根目录启动静态 HTTP 服务后访问 `http://localhost:8000`：

```sh
python3 -m http.server 8000
```

请通过 HTTP(S) 访问页面；直接以 `file://` 打开会阻止浏览器加载 ES 模块。
