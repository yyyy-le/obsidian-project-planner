import {
  ItemView,
  Modal,
  Notice,
  Setting,
  TAbstractFile,
  TFile,
  TFolder,
  WorkspaceLeaf,
  normalizePath,
  setIcon,
} from "obsidian";
import type ProjectPlannerPlugin from "../main";
import type { PlannerProject } from "../settings";
import { renderPlannerHeader } from "./Header";
import { getProjectRootPath } from "../utils/projectPaths";

export const VIEW_TYPE_PROJECT_DOCUMENTS = "project-planner-documents-view";

const FOLDER_CARD_COLORS = ["violet", "blue", "teal", "indigo", "orange", "rose"] as const;

type FileFilter = "all" | "markdown" | "pdf" | "image" | "video" | "audio" | "other";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "mkv", "webm", "avi", "m4v"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "flac", "ogg"]);

class DocumentRootModal extends Modal {
  constructor(
    private plugin: ProjectPlannerPlugin,
    private project: PlannerProject,
    private onSaved: () => void,
  ) {
    super(plugin.app);
  }

  onOpen() {
    this.setTitle("设置项目文档目录");
    let value = this.project.documentRootPath ?? "";
    new Setting(this.contentEl)
      .setName("项目目录")
      .setDesc("填写相对于当前 Obsidian 仓库根目录的项目文件夹，例如：少儿沙盘")
      .addText((text) => {
        text.setPlaceholder("少儿沙盘");
        text.setValue(value);
        text.onChange((next) => { value = next.trim(); });
        text.inputEl.style.width = "100%";
      });

    const actions = this.contentEl.createDiv("planner-docs-modal-actions");
    const cancel = actions.createEl("button", { text: "取消" });
    cancel.onclick = () => this.close();
    const save = actions.createEl("button", { text: "保存", cls: "mod-cta" });
    save.onclick = async () => {
      const path = normalizePath(value.replace(/^\/+|\/+$/g, ""));
      const item = path ? this.app.vault.getAbstractFileByPath(path) : null;
      if (!path || !(item instanceof TFolder)) {
        new Notice("没有找到这个文件夹，请填写仓库内已有文件夹的相对路径。");
        return;
      }
      this.project.documentRootPath = path;
      await this.plugin.saveSettings();
      this.close();
      this.onSaved();
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class ProjectDocumentsView extends ItemView {
  private filter: FileFilter = "all";
  private query = "";
  private pinnedRootPath: string | null = null;
  private mediaMode = false;

  constructor(leaf: WorkspaceLeaf, private plugin: ProjectPlannerPlugin) {
    super(leaf);
  }

  getViewType() { return VIEW_TYPE_PROJECT_DOCUMENTS; }
  getDisplayText() { return "项目文档"; }
  getIcon() { return "folder-tree"; }

  async onOpen() { await this.render(); }

  private getActiveProject(): PlannerProject | null {
    return this.plugin.settings.projects.find((p) => p.id === this.plugin.settings.activeProjectId) ?? null;
  }

  private getConfiguredRoot(project: PlannerProject): TFolder | null {
    const rootPath = getProjectRootPath(this.plugin.settings, project);
    const item = this.app.vault.getAbstractFileByPath(rootPath);
    return item instanceof TFolder ? item : null;
  }

  private getDisplayRoot(projectRoot: TFolder): TFolder {
    if (!this.pinnedRootPath) return projectRoot;
    const item = this.app.vault.getAbstractFileByPath(this.pinnedRootPath);
    if (item instanceof TFolder && (item.path === projectRoot.path || item.path.startsWith(`${projectRoot.path}/`))) {
      return item;
    }
    this.pinnedRootPath = null;
    return projectRoot;
  }

  private classify(file: TFile): FileFilter {
    const ext = file.extension.toLowerCase();
    if (ext === "md") return "markdown";
    if (ext === "pdf") return "pdf";
    if (IMAGE_EXTENSIONS.has(ext)) return "image";
    if (VIDEO_EXTENSIONS.has(ext)) return "video";
    if (AUDIO_EXTENSIONS.has(ext)) return "audio";
    return "other";
  }

  private fileMatches(file: TFile): boolean {
    if (this.filter !== "all" && this.classify(file) !== this.filter) return false;
    const q = this.query.trim().toLocaleLowerCase();
    return !q || file.path.toLocaleLowerCase().includes(q);
  }

  private filesUnder(folder: TFolder): TFile[] {
    const prefix = `${folder.path}/`;
    return this.app.vault.getFiles().filter((f) => f.path.startsWith(prefix) && this.fileMatches(f));
  }

  private directCount(folder: TFolder): { folders: number; files: number } {
    return {
      folders: folder.children.filter((c) => c instanceof TFolder).length,
      files: folder.children.filter((c) => c instanceof TFile && this.fileMatches(c)).length,
    };
  }

  private nestedCount(folder: TFolder): { folders: number; files: number } {
    let folders = 0;
    let files = 0;
    const walk = (current: TFolder) => {
      for (const child of current.children) {
        if (child instanceof TFolder) {
          folders++;
          walk(child);
        } else if (child instanceof TFile && this.fileMatches(child)) {
          files++;
        }
      }
    };
    walk(folder);
    return { folders, files };
  }

  private async openFile(file: TFile) {
    await this.app.workspace.getLeaf("tab").openFile(file);
  }

  private fileIcon(file: TFile): string {
    switch (this.classify(file)) {
      case "markdown": return "file-text";
      case "pdf": return "file-type-2";
      case "image": return "image";
      case "video": return "video";
      case "audio": return "audio-lines";
      default: return "file";
    }
  }

  private folderDescriptionFile(folder: TFolder): TFile | null {
    return folder.children.find(
      (child): child is TFile => child instanceof TFile && child.basename === "文件说明" && child.extension === "md",
    ) ?? null;
  }

  private async folderCardInfo(folder: TFolder): Promise<{
    title: string;
    summary: string;
    tags: string[];
    tone: string;
  } | null> {
    const note = this.folderDescriptionFile(folder);
    if (!note) return null;

    const cache = this.app.metadataCache.getFileCache(note);
    const title = String(cache?.frontmatter?.title || folder.name);
    const rawTags = cache?.frontmatter?.tags;
    const tags = (Array.isArray(rawTags) ? rawTags : typeof rawTags === "string" ? [rawTags] : [])
      .map((tag) => String(tag))
      .filter((tag) => tag !== "文件说明" && tag !== "项目/少儿沙盘")
      .slice(0, 3);
    const tone = String(cache?.frontmatter?.card_color || "violet");
    const frontmatterSummary = cache?.frontmatter?.summary ?? cache?.frontmatter?.description;
    if (frontmatterSummary) {
      return { title, summary: String(frontmatterSummary), tags, tone };
    }

    const content = await this.app.vault.cachedRead(note);
    const body = content
      .replace(/^---[\s\S]*?---\s*/u, "")
      .replace(/^#.+$/gm, "")
      .split(/\n\s*\n/u)
      .map((part) => part.replace(/\s+/gu, " ").trim())
      .find(Boolean) || "此文件夹用于存放项目资料。";
    return { title, summary: body.slice(0, 140), tags, tone };
  }

  private async renderFolderCards(host: HTMLElement, root: TFolder) {
    const folders = root.children
      .filter((child): child is TFolder => child instanceof TFolder)
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));

    const describedFolders: Array<{
      folder: TFolder;
      info: NonNullable<Awaited<ReturnType<ProjectDocumentsView["folderCardInfo"]>>>;
    }> = [];
    for (const folder of folders) {
      const info = await this.folderCardInfo(folder);
      if (info) describedFolders.push({ folder, info });
    }

    const section = host.createDiv("planner-docs-folder-section");
    const header = section.createDiv("planner-docs-folder-section-header");
    header.createEl("h3", { text: "文件夹" });
    const createButton = header.createEl("button", { cls: "planner-docs-create-folder-button" });
    setIcon(createButton, "folder-plus");
    createButton.createSpan({ text: "新建文件夹" });
    createButton.onclick = () => {
      new CreateProjectFolderModal(this.plugin, root, () => { void this.render(); }).open();
    };

    if (describedFolders.length === 0) {
      section.createDiv({
        cls: "planner-docs-folder-card-empty",
        text: "当前层还没有带“文件说明.md”的卡片文件夹。",
      });
      return;
    }

    const grid = section.createDiv("planner-docs-folder-grid");
    describedFolders.forEach(({ folder, info }) => {
      const count = this.directCount(folder);
      const card = grid.createDiv("planner-docs-folder-card");
      card.dataset.tone = info.tone;
      const icon = card.createDiv("planner-docs-folder-card-icon");
      setIcon(icon, "folder");
      const content = card.createDiv("planner-docs-folder-card-content");
      content.createEl("h4", { text: info.title });
      content.createDiv({ text: info.summary, cls: "planner-docs-folder-card-summary" });
      if (info.tags.length > 0) {
        const tagRow = content.createDiv("planner-docs-folder-card-tags");
        info.tags.forEach((tag) => tagRow.createSpan({ text: tag, cls: "planner-docs-folder-card-tag" }));
      }
      content.createDiv({
        text: `${count.folders} 个下级文件夹 · ${count.files} 个文件`,
        cls: "planner-docs-folder-card-meta",
      });
      const arrow = card.createDiv("planner-docs-folder-card-arrow");
      setIcon(arrow, "chevron-right");
      card.onclick = () => {
        this.pinnedRootPath = folder.path;
        void this.render();
      };
    });
  }

  private renderTree(host: HTMLElement, root: TFolder) {
    const columns = host.createDiv("planner-docs-tree-columns");
    columns.createSpan({ text: "名称", cls: "planner-docs-column-name" });
    columns.createSpan({ text: "内容数量", cls: "planner-docs-column-count" });
    columns.createSpan({ text: "修改日期", cls: "planner-docs-column-date" });
    const children = root.children
      .filter((child) => {
        if (child instanceof TFolder) return !this.folderDescriptionFile(child);
        return child instanceof TFile && child.basename !== "文件说明" && this.fileMatches(child);
      })
      .sort((a, b) => {
        if (a instanceof TFolder && b instanceof TFile) return -1;
        if (a instanceof TFile && b instanceof TFolder) return 1;
        return a.name.localeCompare(b.name, "zh-CN", { numeric: true });
      });

    if (children.length === 0) {
      host.createDiv({ cls: "planner-docs-empty", text: "当前层没有符合条件的文件。" });
      return;
    }

    children.forEach((child) => {
      const row = host.createDiv("planner-docs-tree-row planner-docs-file-row");
      const icon = row.createSpan("planner-docs-tree-icon");
      if (child instanceof TFolder) {
        const count = this.directCount(child);
        setIcon(icon, "folder");
        row.createSpan({ text: child.name, cls: "planner-docs-tree-name" });
        row.createSpan({ text: `${count.folders} 个文件夹 · ${count.files} 个文件`, cls: "planner-docs-tree-count" });
        row.createSpan({ text: "", cls: "planner-docs-tree-date" });
        row.onclick = () => {
          this.pinnedRootPath = child.path;
          void this.render();
        };
      } else if (child instanceof TFile) {
        setIcon(icon, this.fileIcon(child));
        row.createSpan({ text: child.name, cls: "planner-docs-tree-name" });
        row.createSpan({ text: "文件", cls: "planner-docs-tree-count" });
        row.createSpan({ text: new Date(child.stat.mtime).toLocaleDateString("zh-CN"), cls: "planner-docs-tree-date" });
        row.onclick = () => void this.openFile(child);
      }
    });
  }

  private renderMedia(host: HTMLElement, root: TFolder) {
    const files = this.filesUnder(root).filter((f) => ["image", "video", "audio", "pdf"].includes(this.classify(f)));
    if (files.length === 0) {
      host.createDiv({ cls: "planner-docs-empty", text: "当前范围内没有可预览的媒体附件。" });
      return;
    }
    const grid = host.createDiv("planner-docs-media-grid");
    files.slice(0, 500).forEach((file) => {
      const card = grid.createDiv("planner-docs-media-card");
      const preview = card.createDiv("planner-docs-media-preview");
      if (this.classify(file) === "image") {
        preview.createEl("img", { attr: { src: this.app.vault.getResourcePath(file), alt: file.name } });
      } else {
        setIcon(preview, this.fileIcon(file));
      }
      card.createDiv({ text: file.name, cls: "planner-docs-media-name" });
      card.onclick = () => void this.openFile(file);
    });
    if (files.length > 500) {
      host.createDiv({ cls: "planner-docs-limit-notice", text: `媒体较多，仅展示前 500 项；请使用搜索或文件类型筛选。` });
    }
  }

  private async render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("planner-documents-wrapper");

    renderPlannerHeader(container, this.plugin, {
      active: "documents",
      hideAddTask: true,
      onProjectChange: () => {
        this.pinnedRootPath = null;
        void this.render();
      },
    });

    const project = this.getActiveProject();
    if (!project) {
      container.createDiv({ cls: "planner-docs-empty", text: "请先创建或选择一个项目。" });
      return;
    }
    const projectRoot = this.getConfiguredRoot(project);
    if (!projectRoot) {
      const empty = container.createDiv("planner-docs-setup");
      empty.createEl("h2", { text: "尚未设置项目文档目录" });
      empty.createEl("p", { text: "设置后，这里会以只读方式展示该项目每一层文件夹和文件。" });
      const button = empty.createEl("button", { text: "设置项目目录", cls: "mod-cta" });
      button.onclick = () => new DocumentRootModal(this.plugin, project, () => this.render()).open();
      return;
    }
    const root = this.getDisplayRoot(projectRoot);
    const allCounts = this.nestedCount(root);

    const heading = container.createDiv("planner-docs-heading");
    const headingText = heading.createDiv();
    headingText.createEl("h2", { text: "项目文档中心" });
    headingText.createDiv({ text: "通过文件夹卡片进入下一层，查看项目资料", cls: "planner-docs-subtitle" });
    headingText.createDiv({ text: root.path, cls: "planner-docs-root-path" });
    const headingActions = heading.createDiv("planner-docs-heading-actions");
    const setRoot = headingActions.createEl("button", { text: "设置目录" });
    setRoot.onclick = () => new DocumentRootModal(this.plugin, project, () => {
      this.pinnedRootPath = null;
      void this.render();
    }).open();

    const toolbar = container.createDiv("planner-docs-toolbar");
    const filter = toolbar.createEl("select", { cls: "planner-docs-filter" });
    ([
      ["all", "全部附件"], ["markdown", "Markdown"], ["pdf", "PDF"],
      ["image", "图片"], ["video", "视频"], ["audio", "音频"], ["other", "其他文件"],
    ] as [FileFilter, string][]).forEach(([value, label]) => {
      const option = filter.createEl("option", { value, text: label });
      option.selected = this.filter === value;
    });
    filter.onchange = () => { this.filter = filter.value as FileFilter; void this.render(); };

    const search = toolbar.createEl("input", { type: "search", placeholder: "搜索文件和文件夹…", cls: "planner-docs-search" });
    search.value = this.query;
    search.onkeydown = (event) => { if (event.key === "Enter") { this.query = search.value; void this.render(); } };
    search.onblur = () => { if (this.query !== search.value) { this.query = search.value; void this.render(); } };

    const stats = container.createDiv("planner-docs-stats");
    const fileStat = stats.createDiv("planner-docs-stat-card");
    fileStat.createDiv({ text: String(allCounts.files), cls: "planner-docs-stat-value" });
    fileStat.createDiv({ text: this.filter === "all" ? "全部文件" : "筛选后的文件", cls: "planner-docs-stat-label" });
    const folderStat = stats.createDiv("planner-docs-stat-card");
    folderStat.createDiv({ text: String(allCounts.folders), cls: "planner-docs-stat-value" });
    folderStat.createDiv({ text: "文件夹", cls: "planner-docs-stat-label" });
    const matchingFiles = this.filesUnder(root);
    const mediaCount = matchingFiles.filter((file) => ["image", "video", "audio", "pdf"].includes(this.classify(file))).length;
    const mediaStat = stats.createDiv("planner-docs-stat-card");
    mediaStat.createDiv({ text: String(mediaCount), cls: "planner-docs-stat-value" });
    mediaStat.createDiv({ text: "可预览附件", cls: "planner-docs-stat-label" });
    await this.renderFolderCards(container, root);

    const browser = container.createDiv("planner-docs-browser");
    const browserHeader = browser.createDiv("planner-docs-browser-header");
    const browserTabs = browserHeader.createDiv("planner-docs-browser-tabs");
    browserTabs.createEl("strong", { text: "项目文件" });
    const treeTab = browserTabs.createEl("button", { text: "目录树", cls: !this.mediaMode ? "active" : "" });
    treeTab.onclick = () => { this.mediaMode = false; void this.render(); };
    const mediaTab = browserTabs.createEl("button", { text: "附件预览", cls: this.mediaMode ? "active" : "" });
    mediaTab.onclick = () => { this.mediaMode = true; void this.render(); };
    const browserActions = browserHeader.createDiv("planner-docs-browser-actions");
    if (root.path !== projectRoot.path) {
      const backButton = browserActions.createEl("button", {
        text: "返回",
        cls: "planner-docs-back-button",
        title: "返回上一级文件夹",
      });
      backButton.onclick = () => {
        const parent = root.parent;
        this.pinnedRootPath = parent instanceof TFolder && parent.path.startsWith(projectRoot.path)
          ? parent.path
          : null;
        void this.render();
      };
    }
    const headerMedia = browserActions.createEl("button", { cls: "planner-docs-browser-mode", title: this.mediaMode ? "切换到目录树" : "切换到附件预览" });
    setIcon(headerMedia, this.mediaMode ? "list-tree" : "layout-grid");
    headerMedia.onclick = () => { this.mediaMode = !this.mediaMode; void this.render(); };
    if (this.mediaMode) this.renderMedia(browser, root);
    else this.renderTree(browser, root);
  }
}

class CreateProjectFolderModal extends Modal {
  constructor(
    private plugin: ProjectPlannerPlugin,
    private parent: TFolder,
    private onCreated: () => void,
  ) {
    super(plugin.app);
  }

  onOpen() {
    this.setTitle("新建项目文件夹");
    let name = "";
    let summary = "";
    let tags = "";

    this.contentEl.createDiv({
      cls: "planner-docs-create-folder-location",
      text: `创建位置：${this.parent.path}`,
    });

    new Setting(this.contentEl)
      .setName("文件夹名称")
      .setDesc("使用清楚、具体的业务名称，不需要添加序号。")
      .addText((text) => {
        text.setPlaceholder("例如：宣传研究");
        text.onChange((value) => { name = value.trim(); });
        text.inputEl.style.width = "100%";
      });

    new Setting(this.contentEl)
      .setName("文件说明")
      .setDesc("用一句话说明这里存放什么内容。")
      .addTextArea((text) => {
        text.setPlaceholder("例如：存放少儿沙盘项目的宣传方向研究与定稿材料。");
        text.onChange((value) => { summary = value.trim(); });
        text.inputEl.rows = 3;
        text.inputEl.style.width = "100%";
      });

    new Setting(this.contentEl)
      .setName("标签")
      .setDesc("建议填写 1—3 个，用逗号分隔。")
      .addText((text) => {
        text.setPlaceholder("例如：宣传, 研究");
        text.onChange((value) => { tags = value; });
        text.inputEl.style.width = "100%";
      });

    const actions = this.contentEl.createDiv("planner-docs-modal-actions");
    const cancel = actions.createEl("button", { text: "取消" });
    cancel.onclick = () => this.close();
    const create = actions.createEl("button", { text: "创建", cls: "mod-cta" });
    create.onclick = async () => {
      if (!name || !summary) {
        new Notice("请填写文件夹名称和文件说明。");
        return;
      }
      if (name === "." || name === ".." || /[\\/:*?"<>|]/u.test(name)) {
        new Notice("文件夹名称包含不能使用的字符。");
        return;
      }
      const targetPath = normalizePath(`${this.parent.path}/${name}`);
      if (this.app.vault.getAbstractFileByPath(targetPath)) {
        new Notice("当前层已经存在同名文件夹。");
        return;
      }
      const normalizedTags = tags.split(/[,，]/u).map((tag) => tag.trim()).filter(Boolean).slice(0, 3);
      const color = FOLDER_CARD_COLORS[Math.floor(Math.random() * FOLDER_CARD_COLORS.length)];
      const tagLines = normalizedTags.length > 0
        ? normalizedTags.map((tag) => `  - ${JSON.stringify(tag)}`).join("\n")
        : "  - \"待分类\"";
      const description = [
        "---",
        `title: ${JSON.stringify(name)}`,
        `summary: ${JSON.stringify(summary)}`,
        `card_color: ${color}`,
        "tags:",
        tagLines,
        "---",
        "",
        `# ${name}`,
        "",
        summary,
        "",
      ].join("\n");
      try {
        await this.app.vault.createFolder(targetPath);
        await this.app.vault.create(normalizePath(`${targetPath}/文件说明.md`), description);
        this.close();
        this.onCreated();
        new Notice(`已创建：${name}`);
      } catch (error) {
        console.error("Failed to create project folder", error);
        new Notice("创建失败，请检查文件夹名称或 Obsidian 权限。");
      }
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}
