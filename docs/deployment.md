# 发布到 Cloudflare Pages

网页部署目录为 `dist/`，无需构建。当前站点使用直接上传，更新 GitHub 仓库后需要另行发布网页。

## 更新网页

先在仓库根目录运行 `npm test`。检查通过后，可在 Cloudflare 控制台进入 `evolution-simulator`，选择创建部署，上传 `dist/` 内的文件（或以这些文件为根的 ZIP）。

也可使用 Cloudflare 官方 Wrangler 工具：

```sh
npx wrangler login
npx wrangler pages deploy dist --project-name=evolution-simulator --branch=main
```

只上传 `dist/`，研究文档、测试和 README 配图留在 GitHub。模拟在访问者的浏览器中计算；导出的 JSON 存档保存在本地。

## 托管范围

- Cloudflare Pages 提供 HTML、样式、脚本、第三方库和后台对照计算程序。
- 页面字体会请求 Google Fonts；Three.js 和 Dagre 已随网页分发。
- 不需要后端、数据库或 AI API 密钥。
- 已公开的源码可独立放到其它静态网站服务；`dist/` 中的原生模块就是当前网页源码。

参考：[Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)。
