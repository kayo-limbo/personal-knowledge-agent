# Dashboard 固定侧栏与独立内容滚动

## 目标与结果

Dashboard 的右侧页面可能包含很长的 Prompt、历史记录、用户列表或统计内容。原布局虽然给侧栏设置了 `h-screen`，但页面实际仍由浏览器的 `body` 滚动，因此向下浏览右侧内容时，左侧导航也会离开视口。

本次调整后的结果是：

- Dashboard 根容器始终占满一个视口，不再让整个页面滚动。
- 左侧导航和顶部 Header 保持在视口内。
- 只有右侧 `<main>` 内容区负责纵向滚动。
- 左侧导航项如果将来多到超过视口，会在侧栏内部独立滚动。
- 右侧容器允许收缩，长文本不会把整个横向布局撑破。

## 相关文件职责

- `src/app/dashboard/layout.tsx`：定义所有 Dashboard 子页面共享的外层布局，决定哪一层占满视口、哪一层可以滚动。
- `src/app/components/dashboard/Sidebar.tsx`：渲染角色过滤后的导航项，并为侧栏自身设置固定宽度和内部溢出策略。
- `src/app/components/dashboard/Header.tsx`：顶部用户信息和退出入口。它位于不滚动的右侧外壳中，因此主内容滚动时仍保持可见。

## 布局数据流

这里没有业务数据写入，核心是布局约束逐层传递：

```text
浏览器视口 h-screen
├── Sidebar：h-full + w-56 + shrink-0
│   ├── 品牌区
│   └── nav：空间不足时内部 overflow-y-auto
└── 右侧外壳：min-w-0 + flex-1 + overflow-hidden
    ├── Header：保持在右侧顶部
    └── main：min-h-0 + overflow-y-auto
        └── 当前路由的 page.tsx 内容
```

用户切换路由时，Next.js 的共享 Layout 保留，只有 `children` 对应的页面内容变化。滚动责任始终留在 `<main>`，不会因为切换到长列表页而改变。

## 关键代码解释

### 为什么根容器使用 `h-screen overflow-hidden`

`h-screen` 把 Dashboard 高度限制为当前视口高度，`overflow-hidden` 阻止根容器产生浏览器级滚动条。这样侧栏不会进入右侧长内容的滚动上下文。

只写 `min-h-screen` 或给 Sidebar 写 `h-screen` 都不够：右侧内容仍能继续把整个文档撑高，最终滚动的还是整个页面。

### 为什么右侧外壳需要 `min-w-0` 和 `overflow-hidden`

Flex 子项默认最小宽度可能等于其内容宽度。代码块、表格或长链接可能把右侧撑宽，造成水平溢出。`min-w-0` 允许右侧区域缩小到剩余空间，`overflow-hidden` 则建立清晰的内容边界。

### 为什么 `<main>` 同时需要 `min-h-0` 和 `overflow-y-auto`

在纵向 Flex 布局里，子项默认的最小高度可能阻止它缩小，从而继续撑高父容器。`min-h-0` 允许 `<main>` 使用 Header 之外的剩余高度，`overflow-y-auto` 再把超出的内容变成右侧区域自己的滚动条。

### 为什么 Sidebar 使用 `shrink-0`

侧栏宽度是导航布局的一部分。`shrink-0` 防止右侧出现宽内容时 Flex 算法压缩 `w-56`，避免导航文字和图标被挤坏。

## 设计取舍

本次没有使用 CSS `position: fixed`。真正的需求是“右侧滚动时侧栏不动”，通过固定视口外壳和独立滚动区即可实现，而且不需要给右侧手工增加 `margin-left: 14rem`，也不会产生 fixed 元素覆盖正文的问题。

当前保持桌面端 224px 宽侧栏，不在这个小功能里同时引入移动端抽屉菜单。截止验收前应优先保证桌面演示稳定；窄屏导航属于后续独立的响应式功能块。

## 面试重点

可以这样解释：

1. `h-screen` 只是高度约束，不会自动固定元素；关键在于明确谁是滚动容器。
2. 根布局禁止滚动，右侧 `<main>` 使用 `overflow-y-auto`，因此侧栏天然留在视口中。
3. Flex 嵌套滚动常见的两个细节是纵向的 `min-h-0` 和横向的 `min-w-0`，缺少它们时内容可能拒绝收缩。
4. 选择独立滚动容器而不是 `position: fixed`，减少偏移量同步、内容遮挡和响应式维护成本。

## 易错点

- 只给 Sidebar 设置 `h-screen`：它仍会随整个文档滚走。
- 给 Sidebar 设置 `fixed`，却忘记给右侧留出同等宽度：正文会被覆盖。
- 给 `<main>` 设置 `overflow-y-auto`，但父级没有确定高度：不会形成期望的内部滚动。
- 忘记 `min-h-0`：Flex 子项可能把父级继续撑高，滚动责任又回到外层。
- 把整个右侧外壳设为滚动区：Header 会跟随内容滚走。

## 验证方法

### 2026-09-09 实际回归与旧镜像问题

用户反馈侧栏仍随长内容滚动后，检查发现本地 `localhost:3000` 的 Compose 应用容器未包含 `bcbf877` 中的 `flex h-screen overflow-hidden bg-gray-50` 布局。代码已经提交不等于运行中的 Docker 镜像已经更新；容器不会像开发服务器一样自动读取工作区文件。

执行 `docker compose --env-file .env.docker up --build -d app` 后，生产构建通过，应用容器重建，已有 PostgreSQL volume 保留，没有执行 seed。此次修复运行环境，没有再次修改布局代码。两处用户 Knowledge 未提交修改保持原样；本地镜像按当前工作区构建，不能声称它与 Git 提交逐字节一致。

使用隔离的真实 Chrome 无头浏览器，以本地 ADMIN 演示账号登录，在 1280×720 视口逐一检查 AI 对话、知识库、Prompt 管理、历史记录、用户管理、系统统计。每个页面仅在浏览器 DOM 临时追加 2400px 内容，不写入数据库，然后将 `<main>` 滚动 1200px 并尝试滚动 window。六页均得到：

- 侧栏滚动前后 top 均为 0，Header top 为 0。
- main.scrollTop 为 1200，window.scrollY 为 0。
- 文档高度与视口高度均为 720，没有产生整页纵向滚动。

这是本地生产容器的布局回归，不等于公网全功能验收。GitHub Actions 的 `bcbf877` 已 success，Render 部署 `dep-dag3qch594qs73foe0fg` 已 live 且提交相同；公网登录后的长内容滚动、Markdown、停止按钮等仍需独立验证。

遇到“源码已改但界面没变”，先确认访问地址和运行方式：`npm run dev` 会更新源码，而 Compose 必须重新 build 并重建应用；Render 则需要确认 live 的 commit。不要仅凭编辑器里的代码判断浏览器实际收到的版本。

自动检查：

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

浏览器手工检查：

1. 用管理员账号进入 Prompt 管理、历史记录、用户管理或系统统计。
2. 准备超过一个视口高度的内容，并滚动到页面底部。
3. 确认左侧品牌区和导航位置不变，顶部 Header 仍然可见。
4. 确认滚动条属于右侧内容区，导航点击和当前项高亮仍正常。
5. 缩窄窗口，确认右侧不会因长文本覆盖侧栏；记录移动端抽屉仍未实现这一已知限制。

## 后续改进

- 独立实现移动端折叠导航或抽屉，不与桌面固定侧栏逻辑混在一起。
- 根据产品需要记录各路由的滚动位置，切回列表页时恢复浏览位置。
- 为超长表格增加局部横向滚动和固定表头。
- 使用真实浏览器端到端测试自动断言侧栏位置在滚动前后保持不变。
