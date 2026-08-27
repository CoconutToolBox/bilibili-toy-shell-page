/// <reference path="./toy.d.ts" />

/**
 * @file 椰果工具箱 Toy 壳页脚本
 * @description 由 index.html 的内联脚本拆分而来：负责主站 iframe 承载、
 * 桌面视口缩放、横屏强制控制与用户身份透传。
 *
 * 依赖：head 中的 toy-sdk.js 加载后挂载全局 `window.toy`；
 * 类型声明见 ./toy.d.ts（本文件顶部已引用，IDE 可直接补全 `toy` / `window.toy`）。
 */

/* ── DOM 引用 ─────────────────────────────────────────────── */

/** 主站 iframe（承载工具站页面） */
const frame = /** @type {HTMLIFrameElement} */ (
    document.getElementById('frame')
)

/** 加载指示层 */
const loader = /** @type {HTMLElement} */ (document.getElementById('loader'))

/** 桌面视口容器（按设计宽度等比缩放） */
const wrap = /** @type {HTMLElement} */ (document.getElementById('frame-wrap'))

/* ── 桌面视口适配 ─────────────────────────────────────────── */
/* 手机等窄屏：iframe 固定 1280px 宽渲染桌面布局，等比缩放到屏幕宽度；
   桌面（≥1280px）：不缩放，全屏。 */

/** 桌面布局的设计宽度（px） */
const DESKTOP_WIDTH = 1280

/**
 * 根据当前视口宽度计算缩放比例并应用到容器。
 */
function applyViewport() {
    const scale = Math.min(1, window.innerWidth / DESKTOP_WIDTH)
    wrap.style.width = DESKTOP_WIDTH + 'px'
    wrap.style.height = Math.ceil(window.innerHeight / scale) + 'px'
    wrap.style.transform = scale < 1 ? `scale(${scale})` : 'none'
}

window.addEventListener('resize', applyViewport)
window.addEventListener('orientationchange', () =>
    setTimeout(applyViewport, 200),
)
applyViewport()

/* ── 横屏引导 ─────────────────────────────────────────────── */
/* App 内初次进入由 initContainerMode 用 setContainerMode 强制横屏沉浸式，
   结果出来前隐藏提示层避免闪现；Web / 旧客户端无法强制，竖屏触摸设备
   显示提示层（不可跳过），引导手动旋转，旋转后自动隐藏。 */

/** 横屏提示层 */
const rotateHint = /** @type {HTMLElement} */ (
    document.getElementById('rotate-hint')
)

/** 初次强制横屏流程是否已结束（成败皆算） */
let containerSettled = false

/** 容器当前方向，由 onContainerChange 跟踪 */
let containerOrientation = /** @type {ToySDK.ToyOrientation | null} */ (null)

/**
 * 判断当前是否处于「竖屏 + 触摸设备」（需要提示旋转的场景）。
 * @returns {boolean} 竖屏触摸设备返回 true
 */
function isPortraitCoarse() {
    return (
        window.innerHeight > window.innerWidth &&
        window.matchMedia('(pointer: coarse)').matches
    )
}

/**
 * 更新横屏提示层的显示/隐藏。
 * 初次强制横屏结果出来前始终隐藏，避免竖屏 App 内闪现。
 */
function updateRotateHint() {
    if (!containerSettled) {
        /** 初次强制横屏尚未出结果，先不弹提示层 */
        rotateHint.hidden = true
        return
    }
    rotateHint.hidden = !isPortraitCoarse()
}

window.addEventListener('resize', updateRotateHint)
window.addEventListener('orientationchange', () =>
    setTimeout(updateRotateHint, 200),
)
updateRotateHint()

/* ── 自动认证（静默）─────────────────────────────────────── */
/* 已有未过期的 B站 用户授权 → 自动复用直接成功；从未授权（平台要求手势）
   → 自动调用被拦，静默降级（无任何提示），主站功能不受影响。 */

/** 是否已向主站发送过用户身份 */
let profileSent = false

/** 最近一次发送的用户身份 */
let lastProfile = /** @type {ToySDK.UserProfileResp | null} */ (null)

/**
 * 等待 Toy SDK 加载就绪。
 * @param {number} timeoutMs 超时毫秒数
 * @returns {Promise<boolean>} SDK 就绪返回 true，超时返回 false
 */
function waitForSdk(timeoutMs) {
    const start = Date.now()
    return new Promise((resolve) => {
        const timer = setInterval(() => {
            if (typeof window.toy?.getUserProfile === 'function') {
                clearInterval(timer)
                resolve(true)
            } else if (Date.now() - start > timeoutMs) {
                clearInterval(timer)
                resolve(false)
            }
        }, 100)
    })
}

/**
 * 向 iframe 内的主站发送用户身份。
 * @param {ToySDK.UserProfileResp} profile 用户资料（头像、昵称、Toy 内标识）
 */
function sendProfile(profile) {
    if (!frame.contentWindow || !profile) return
    frame.contentWindow.postMessage({ type: 'toy-profile', profile }, '*')
    profileSent = true
    lastProfile = profile
}

/**
 * 静默自动认证：已有授权直接复用；未授权/需手势触发时静默降级。
 * @returns {Promise<void>}
 */
async function autoAuth() {
    const ready = await waitForSdk(8000)
    if (!ready) return
    try {
        const profile = await window.toy.getUserProfile()
        sendProfile(profile)
    } catch {
        /** 静默：未授权/手势要求，不做任何提示 */
    }
}

autoAuth()

/* ── 容器模式：初次进入强制横屏沉浸式 ─────────────────────── */
/* SDK 1.7 起提供 setContainerMode，可强制容器方向与沉浸状态（仅 B站 App 内，
   Web 端调用抛 unsupported）。初次进入壳页即请求横屏沉浸式；
   不支持时静默降级，由上方横屏提示层引导用户手动旋转设备。 */

/**
 * 标记初次强制横屏流程结束，并刷新提示层。
 */
function setContainerSettled() {
    containerSettled = true
    updateRotateHint()
}

/**
 * 初次进入时请求容器切换为横屏沉浸式。
 * 先 onContainerChange 监听（SDK 推荐做法，可确认切换结果），再 setContainerMode。
 * @returns {Promise<void>}
 */
async function initContainerMode() {
    const ready = await waitForSdk(8000)
    if (!ready || typeof window.toy?.setContainerMode !== 'function') {
        setContainerSettled()
        return
    }
    try {
        const supported = await window.toy.isSupport('setContainerMode')
        if (!supported) {
            setContainerSettled()
            return
        }
        /** 先监听再设置（SDK 推荐做法）：监听可确认切换结果，并跟踪当前方向 */
        window.toy.onContainerChange((state) => {
            containerOrientation = state.orientation
            updateRotateHint()
        })
        await window.toy.setContainerMode({
            orientation: 'landscape',
            immersive: true,
        })
    } catch {
        /** 静默：旧客户端不支持等，保持提示层引导 */
    }
    setContainerSettled()
}

initContainerMode()

/* ── hash 透传 ─────────────────────────────────────────────── */
/* 壳页自身 URL 的 hash（#import_project= / #websocket= / #reset-cache 等）
   同步到 iframe src，主站加载后由其 hash 动作系统自动分发。 */

/**
 * 取 iframe 当前 src 去掉 hash 后的基础地址。
 * @returns {string} 基础地址
 */
function frameBase() {
    const src = frame.getAttribute('src') || ''
    return src.split('#')[0]
}

/**
 * 将壳页 URL 的 hash 同步到 iframe src。
 */
function syncFrameHash() {
    const target = frameBase() + (location.hash || '')
    if (frame.src !== target) frame.src = target
}

window.addEventListener('hashchange', syncFrameHash)
syncFrameHash()

/* ── iframe 加载 ───────────────────────────────────────────── */
/* 隐藏 loader；无条件重发 toy-environment（告知主站在 Toy 壳内，与认证结果无关），
   若身份已获取过则同时重发 toy-profile（hash 透传会触发导航）。 */

/**
 * 向主站重发「处于 Toy 壳内」的环境通知。
 */
function resendEnvironment() {
    if (!frame.contentWindow) return
    frame.contentWindow.postMessage({ type: 'toy-environment' }, '*')
}

/**
 * 向主站重发用户身份（仅当已获取过）。
 */
function resendProfile() {
    if (!profileSent || !frame.contentWindow || !lastProfile) return
    frame.contentWindow.postMessage(
        { type: 'toy-profile', profile: lastProfile },
        '*',
    )
}

/**
 * 在 iframe 加载后的多个时间点重发环境/身份，提高主站接收概率。
 */
function scheduleResend() {
    ;[300, 800, 1500].forEach((ms) => setTimeout(resendEnvironment, ms))
    if (profileSent) {
        ;[300, 800, 1500].forEach((ms) => setTimeout(resendProfile, ms))
    }
}

resendEnvironment()
frame.addEventListener('load', () => {
    loader.hidden = true
    scheduleResend()
})

/* ── 「切换横屏」按钮 ──────────────────────────────────────── */
/* 提示层里的按钮：App 内调 setContainerMode 强制横屏沉浸式；
   若容器已在横屏则切回竖屏（非沉浸，手机不支持横屏+非沉浸组合）。
   Web 端不支持 setContainerMode，静默无操作，提示层保留供手动旋转。 */

/** 横屏切换按钮（提示层内） */
const rotateBtn = /** @type {HTMLButtonElement | null} */ (
    document.getElementById('rotate-btn')
)

if (rotateBtn) {
    rotateBtn.addEventListener('click', () => {
        if (typeof window.toy?.setContainerMode !== 'function') return
        const goLandscape = containerOrientation !== 'landscape'
        window.toy
            .setContainerMode(
                goLandscape ?
                    { orientation: 'landscape', immersive: true }
                :   { orientation: 'portrait', immersive: false },
            )
            .catch(() => {
                /** 静默：Web / 旧客户端不支持或调用失败 */
            })
    })
}
