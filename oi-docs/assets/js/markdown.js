import markdownit from 'https://esm.sh/markdown-it@14.1.0';
import markdownItKatex from 'https://esm.sh/@vscode/markdown-it-katex@1.1.2';
import hljs from 'https://esm.sh/highlight.js@11.9.0';

const markdown = markdownit({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(source, language) {
    if (language && hljs.getLanguage(language)) {
      try {
        return '<pre class="hljs"><code>' +
          hljs.highlight(source, { language, ignoreIllegals: true }).value +
          '</code></pre>';
      } catch (error) {
        console.warn(`代码高亮失败（${language}）`, error);
      }
    }
    return '<pre class="hljs"><code>' + markdown.utils.escapeHtml(source) + '</code></pre>';
  },
});

markdown.use(markdownItKatex, { throwOnError: false, errorColor: '#cf222e' });

export default markdown;
