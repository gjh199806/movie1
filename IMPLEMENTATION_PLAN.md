# LibreTV-App 三阶段改造记录

本次改造基于用户提供的 ZIP，在独立工作副本中实施；没有修改或推送 GitHub 上游仓库。

## 阶段一：用户流程与使用便捷性

- [x] 新搜索启动时递增请求令牌，旧搜索即使稍后返回也不能覆盖新搜索结果。
- [x] 将多源搜索结果按规范化标题、年份和类型分组；同一作品保留每个数据源的入口。
- [x] 搜索结果卡片改用 DOM API 和 `textContent` 渲染，不再把片名、来源名、播放 ID 拼接到内联 JavaScript 中。
- [x] 展示结果总数、正常响应的数据源数及失败源数；区分“没有匹配结果”和“所有数据源均失败”，提供重试入口。
- [x] 将每个源的分页抓取上限限制为 3 页，避免一次搜索发起过多请求。
- [x] 设置页增加“检测已选数据源”，验证 HTTP 响应和 Apple CMS `list` 数据结构。
- [x] 自定义 API 地址校验 HTTP(S) 协议、格式及 URL 内嵌账号密码；自定义源展示字段进行 HTML 转义。
- [x] 保留现有历史记录和播放进度恢复实现；本次未重写播放器状态机。

## 阶段二：数据与服务边界

- [x] 新增 `public/js/core_services.js`，提供 HTML 转义、JSON 容错、HTTP(S) URL 校验、标题归一化、跨源去重和本地存储安全读取。
- [x] 将共享服务加载到 Tauri 实际使用的 `public/index.html`。
- [x] 本地 `selectedAPIs` / `customAPIs` 数据损坏或类型异常时，应用可使用默认值继续初始化。
- [x] 配置导入在哈希验证后再做字段白名单、JSON 结构、布尔值和自定义源 URL 校验；不再导入任意 localStorage 键。
- [ ] JavaScript 与 Rust 中的遗留 API 源定义尚未完全合并为单一配置文件。前端搜索目前通过 Rust 的通用 HTTP 命令请求完整 URL，而 Rust 中另有一套旧源表；应在有 Rust 工具链的环境下对命令调用和旧接口兼容性做专项验证后再清理，避免无验证重构影响原生端。
- [ ] 尚未将业务逻辑整体迁移到 TypeScript 或构建工具；本次保持现有 Vanilla JS 与 Tauri 结构，控制改造范围。

## 阶段三：跨平台与质量

- [x] 增加 `/` 或 `F` 聚焦搜索框的快捷键；正在编辑输入框时不拦截。
- [x] `Escape` 关闭详情弹窗或自定义源表单。
- [x] 增加键盘 `:focus-visible` 样式、减少动态效果偏好支持及小屏设置布局优化。
- [x] 增加 Node 原生测试，覆盖共享 helper 的转义、JSON 容错、URL 校验、结果去重和不同年份区分。
- [ ] 尚未在 Android 真机、Windows/macOS/Linux GUI 环境中验证 UI、播放器切源、后台恢复和原生打包。

## 验证结果

- `npm test`：通过，7 个测试全部通过。
- `node --check`：`public/js` 下全部 JavaScript 文件通过语法检查。
- `cargo check --manifest-path src-tauri/Cargo.toml`：未执行成功；当前工作环境没有安装 `cargo`（命令不存在）。这不是代码编译通过的证明。
- 还需要在目标平台执行 Tauri 桌面端构建和 Android 真机回归。

## 主要变更文件

- `public/js/core_services.js`（新增）
- `public/js/search_logic.js`
- `public/js/app_globals.js`
- `public/js/api_management.js`
- `public/js/config_io.js`
- `public/js/app_event_listeners.js`
- `public/index.html`
- `public/css/styles.css`
- `tests/core_services.test.cjs`（新增）
- `package.json`


## 第二轮改造（2026-10-18）

### 本轮变更

- [x] 修复播放进度恢复与保存使用不同 localStorage key 的问题：恢复端现在与 `getVideoId()` 采用相同的 URL 编码键。
- [x] 播放错误面板增加“重试当前播放源”操作；用户主动重试时先保存当前进度，再重新加载播放器页面，避免重复堆叠 DPlayer/HLS 实例。主 `public/player.html` 与根目录兼容页面均包含该操作。
- [x] Rust `make_http_request` 在原生边界校验 URL 仅允许无凭据 HTTP(S)，并将超时限制在 3–60 秒。
- [x] Rust HTTP 响应体设置 15 MiB 上限，防止异常或失控响应无限占用内存；日志不再打印完整 URL、请求头或响应正文片段。
- [x] 新增回归测试，校验 JS/Rust 的数据源 ID 集合一致、播放进度键一致、重试入口存在及 Rust 请求防护存在。

### 第二轮测试

- `npm test`：11 个测试通过。
- `node --check`：根目录 `js/*.js` 与 `public/js/*.js` 全量语法检查通过。
- Rust 编译：当前环境未确认安装 Cargo，尚不能宣称通过；请在具备 Rust 工具链的机器上运行 `cargo check --manifest-path src-tauri/Cargo.toml`。
- 真实视频播放与 Android/桌面 GUI 回归：仍需在目标设备完成。

### 尚未完成

- 播放器自动切换到其他资源站：当前详情页通常只保存单一来源的剧集 URL，缺少跨源剧集映射；不应在缺少映射时盲目切换到另一个作品或剧集。第二轮先提供安全的手动重试。
- JS/Rust 数据源配置仍以一致性测试防止漂移，尚未迁移成单一生成源。
