# bilibili-toy-shell-page

椰果工具箱 部署到 Bilibili Toy 平台所用的壳页

## 文件结构

| 文件 | 说明 |
| ---- | ---- |
| `index.html` | 页面结构（引入样式与脚本；`#frame` 由脚本在页面加载后动态挂载） |
| `style.css` | 全部样式 |
| `script.js` | 壳页逻辑（主站 iframe 动态挂载、视口适配、横屏控制、身份透传） |
| `toy.d.ts` | Toy JS SDK 类型声明，IDE 中 `toy` / `window.toy` 可补全 |
| `tsconfig.json` | JS 类型检查配置（`checkJs`），供 IDE 与 `tsc` 使用 |
| `build.mjs` | 打包脚本：压缩三个文件并输出 `dist/out.zip` |

## 打包

```sh
npm install
npm run build
```

产物：`dist/out.zip`，zip 根目录仅含最小化的 `index.html`、`style.css`、`script.js`。

## 校验

```sh
tsc --noEmit -p .
```
