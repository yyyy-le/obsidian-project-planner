# Obsidian Project Planner

一个面向个人项目工作的 Obsidian 项目计划插件。

## 当前功能

- 网格视图：查看和编辑任务、状态、优先级、标签及日期
- 看板视图：按分组整理任务
- 时间线视图：按周或按月查看任务安排
- 仪表盘：查看项目完成情况和工时汇总
- 我的任务：集中查看近期需要处理的任务
- 项目文档：按项目目录浏览文件夹、说明卡片、标签和附件
- 新建文件夹：在当前文档层级创建文件夹，并自动生成 `文件说明.md`
- Markdown 同步：任务计划和项目文档分开管理

## 目录说明

```text
src/          TypeScript 源代码
tests/        自动化测试
main.js       构建后的插件代码
styles.css    插件样式
manifest.json Obsidian 插件清单
```

## 开发

```bash
npm install
npm run build
```

构建后的 `main.js`、`styles.css` 和 `manifest.json` 可复制到 Obsidian 插件目录。

## 说明

本项目基于 MIT License 的开源项目进行修改和扩展，许可证及原始版权声明保留在 `LICENSE` 文件中。
