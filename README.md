# bilibili-toy-shell-page

椰果工具箱 部署到 Bilibili Toy 平台所用的壳页

## 文件结构

| 文件 | 说明 |
| ---- | ---- |
| `index.html` | 页面结构（引入样式与脚本） |
| `style.css` | 全部样式 |
| `script.js` | 壳页逻辑（视口适配、横屏控制、身份透传等） |
| `toy.d.ts` | Toy JS SDK 类型声明，IDE 中 `toy` / `window.toy` 可补全 |
| `tsconfig.json` | JS 类型检查配置（`checkJs`），供 IDE 与 `tsc` 使用 |

## 校验

```sh
tsc --noEmit -p .
```
