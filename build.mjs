/**
 * @file 打包脚本：压缩 index.html / style.css / script.js 并输出 dist/out.zip
 * @description zip 根目录只保留三个最小化文件，页面内的相对引用可直接生效。
 * 用法：`npm install` 后执行 `npm run build`（或 `node build.mjs`）。
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { minify as minifyHtml } from 'html-minifier-terser'
import CleanCSS from 'clean-css'
import { minify as minifyJs } from 'terser'
import { strToU8, zipSync } from 'fflate'

/** 项目根目录 */
const ROOT = dirname(fileURLToPath(import.meta.url))
/** 输出目录 */
const DIST = join(ROOT, 'dist')
/** 输出文件 */
const OUT = join(DIST, 'out.zip')
/** 参与打包的文件（扁平放入 zip 根目录） */
const FILES = ['index.html', 'style.css', 'script.js']

/**
 * 字节数格式化为 KB。
 * @param {number} bytes 字节数
 * @returns {string} 形如 "1.2 KB"
 */
function kb(bytes) {
    return (bytes / 1024).toFixed(1) + ' KB'
}

/**
 * 压缩 CSS（level 2：合并规则、压缩选择器等）。
 * @param {string} css 原始样式
 * @returns {Promise<string>} 压缩后的样式
 */
async function minifyCss(css) {
    return new CleanCSS({ level: 2 }).minify(css).styles
}

/**
 * 压缩 JS：只做压缩与变量名混淆，保留顶层声明（壳页函数会被主站以外的方式间接调用）。
 * @param {string} js 原始脚本
 * @returns {Promise<string>} 压缩后的脚本
 */
async function minifyJsCode(js) {
    const result = await minifyJs(js, {
        compress: true,
        mangle: true,
        format: { comments: false },
    })
    if (typeof result.code !== 'string') throw new Error('terser 未返回压缩结果')
    return result.code
}

/**
 * 压缩 HTML：去注释、折叠空白、压缩属性引号。
 * @param {string} html 原始页面
 * @returns {Promise<string>} 压缩后的页面
 */
async function minifyHtmlCode(html) {
    return minifyHtml(html, {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeAttributeQuotes: true,
        sortAttributes: true,
        useShortDoctype: true,
        keepClosingSlash: true,
        minifyCSS: false,
        minifyJS: false,
    })
}

/**
 * 构建：压缩三个文件 → 自检 → 写入 dist/out.zip。
 * @returns {Promise<void>}
 */
async function main() {
    const source = {}
    for (const name of FILES) {
        source[name] = await readFile(join(ROOT, name), 'utf8')
        if (!source[name].trim()) throw new Error(`${name} 内容为空`)
    }

    const output = {
        'style.css': await minifyCss(source['style.css']),
        'script.js': await minifyJsCode(source['script.js']),
        'index.html': await minifyHtmlCode(source['index.html']),
    }

    // 自检 1：压缩后的脚本必须能被解析（new Function 只编译、不执行）
    try {
        new Function(output['script.js'])
    } catch (err) {
        throw new Error(`压缩后的 script.js 语法错误：${err.message}`)
    }
    // 自检 2：页面仍正确引用另外两个文件（相对路径依赖同名文件在 zip 根目录）
    for (const ref of ['style.css', 'script.js']) {
        if (!output['index.html'].includes(ref)) {
            throw new Error(`index.html 缺少对 ${ref} 的引用`)
        }
    }

    const zip = zipSync(
        Object.fromEntries(
            Object.entries(output).map(([name, text]) => [name, strToU8(text)]),
        ),
        { level: 9 },
    )

    await mkdir(DIST, { recursive: true })
    await writeFile(OUT, zip)

    console.log('压缩结果：')
    for (const name of FILES) {
        console.log(
            `  ${name.padEnd(11)} ${kb(source[name].length).padStart(8)} → ${kb(
                output[name].length,
            ).padStart(8)}`,
        )
    }
    console.log(`\n✓ ${join(relative(ROOT, DIST), 'out.zip')} (${kb(zip.length)})`)
}

main().catch((err) => {
    console.error('构建失败：', err)
    process.exitCode = 1
})
