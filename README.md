# 归航 · 蛊界异客

一款网页端单人 AI 对话情景 RPG。玩家作为来自机甲世界的驾驶员意外来到蛊界，与机甲 AI「归航」及当地角色对话、做出选择、寻找回到爱人身边的方法。

## 仓库内容

| 路径 | 内容 |
| --- | --- |
| `web/` | 原 Sites 版本：React / Next.js 页面、vinext / Cloudflare 运行适配、D1 存储；包含较新的移动端适配。 |
| `volcengine/` | 独立火山引擎迁移版：标准 Next.js Node standalone 服务、TOS 存储及模型调用额度控制。 |
| `PRD.md` | 产品需求文档。 |
| `前端技术适配声明.md` | 前端选型、适配原因与方案差异。 |
| `本阶段前端开发文档.md` | 页面、组件、接口、状态及验收说明。 |

两个版本分别安装依赖、启动和部署，不是一个需要同时运行的应用。它们目前不共享玩家存档。PRD 与阶段文档保留设计过程，实际已实现功能以对应版本源码和测试为准。

## 本地开发

建议使用 Node.js 22.13 或更新的兼容版本与 npm。选择一个版本：

```bash
cd web
npm ci
cp .env.example .env.local
npm run dev
```

或者：

```bash
cd volcengine
npm ci
cp .env.example .env.local
npm run dev
```

在本机编辑 `.env.local`，不要提交真实密钥。按终端显示的地址访问本地开发站点。

- AI 对话需要 `DEEPSEEK_API_KEY`；没有配置或调用失败时，游戏使用已有的本地叙事降级逻辑。
- GitHub 登录需要自行创建 OAuth App，并配置 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`；回调路径为 `/api/auth/github/callback`，域名和端口必须与实际运行地址一致。上传到 GitHub 不会自动完成游戏的 GitHub 登录配置，游客入口仍保留。
- `web/` 使用 Cloudflare D1 绑定 `DB`，数据库结构和迁移文件在 `db/`、`drizzle/`。`.openai/hosting.json` 保留原项目绑定供现有构建配置读取；部署到其他账号时必须使用自己的项目与数据库配置。
- `volcengine/` 的建档和持久化需要配置自己的私有 TOS 存储及最小权限凭据，详见 `.env.example`、`docs/iam-runtime-policy.json` 与 `docs/migration-status.md`。存储桶必须从未启用版本控制；缺少存储配置时健康检查会返回未就绪，不能正常保存游戏。

## 检查与构建

在所选版本目录运行：

```bash
npm test
npm run lint
npm run build
```

火山引擎版本另外提供 `npm run typecheck`，构建后可用 `npm start` 启动 standalone 服务。`web/` 的构建和运行依赖其 vinext / Sites / Cloudflare 适配，不应把两个版本的构建产物混用。

## 安全与部署说明

- 本仓库是当前项目的源码快照，不包含旧仓库的提交历史。
- 不包含真实环境密钥、云端本地认证状态、玩家存档、数据库导出、依赖目录或构建缓存；仅提供空值配置示例。
- 火山引擎的 `configure-runtime.mjs`、`verify-live.mjs`、`verify-tos.mjs` 和 IAM 策略保留了原部署的非敏感标识。它们会访问或修改真实云资源，不能当作通用本地启动脚本直接运行；使用前须替换为自己的目标并确认权限及费用。
- 迁移记录的公开副本移除了个人本机路径、私人预算和操作授权对话；未完成事项仍如实保留。
- 上传源码不会重新发布网站、迁移存档、创建云资源或变更现有线上服务。该项目有服务端接口，不是可以直接用 GitHub Pages 托管的纯静态游戏。

## 素材与权利说明

本项目基于《蛊真人》世界观创作，非官方作品。小说、音乐及其他第三方素材的权利归相应权利人所有；公开代码不代表取得这些内容的再授权。

背景音乐来源及许可记录见两个版本各自的 `public/audio/ASSET-LICENSES.md`。本仓库未另行授予通用开源许可证，使用或再次发布前请核实对应内容的许可范围。
