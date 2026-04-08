# GhostPCB Web

纯前端本地版 GhostPCB。当前实现遵循 `./dev-docs` 约束：

- React + TypeScript + Vite
- Web Worker 执行 ZIP 解包、Gerber 处理和重打包
- 第一阶段只实现真实启用能力：
  - 丝印层统一轻微平移
  - 非 EasyEDA 文件头注入
  - 非钻孔文件 LCEDA 风格签名注入
  - 多结果 ZIP 生成与下载

## 开发命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
```

## 目录结构

```text
src/
├─ app/
├─ features/gerber-process/
├─ core/
│  ├─ gerber/
│  ├─ random/
│  └─ zip/
├─ worker/
└─ shared/
```

## 当前行为说明

- 输入：单个 `.zip` Gerber 压缩包，生成数量 `1-99`
- 处理线程：全部在 Web Worker 中执行
- 输出：`Gerber_PCB{序号}_YYYY-MM-DD.zip`
- 未知文件：原样保留
- 钻孔文件：不做头注入、不做签名注入、不做扰动

## 测试覆盖

已覆盖的关键点：

- 文件类型识别
- EasyEDA 来源检测
- 丝印层位移且不改 `I/J`
- LCEDA 风格签名注入
- ZIP 输入到多 ZIP 输出的集成链路
