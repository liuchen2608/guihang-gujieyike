# GitHub 同步说明

本目录的根仓库对应 `liuchen2608/guihang-gujieyike`。

- `web/` 同时保留 Sites 托管所需的独立 Git 历史；不要删除 `web/.git`。
- 项目根仓库用于同步 GitHub 公开源码与文档。
- 同步时不得提交 `.env.local`、真实密钥、玩家数据、`private-migration/`、依赖目录、缓存或构建产物。
- `volcengine/docs/migration-status.md` 含本地运维记录，公开仓库保留脱敏版本，不以本地文件覆盖。
- 修改完成后先运行相关测试，再从项目根目录创建同步分支并提交；通过 GitHub 拉取请求合并到 `main`。

当前线上试玩、火山引擎部署和 GitHub 仓库是三个独立目标。同步 GitHub 不会自动重新发布网站，也不会迁移玩家存档。
