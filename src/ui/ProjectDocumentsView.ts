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

export const VIEW_TYPE_PROJECT_DOCUMENTS = "project-planner-documents-view";

type FileFilter = "all" | "markdown" | "pdf" | "image" | "video" | "audio" | "other";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "mkv", "webm", "avi", "m4v"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "flac", "ogg"]);
const MAX_RENDERED_ROWS = 3000;

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
      .setDesc("填写相对于 Obsidian 仓库根目录的文件夹路径，例如：professional/10-进行中项目/客从何处来")
      .addText((text) => {
        text.setPlaceholder("professional/项目名称");
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
  private nestedCounts = true;
  private expandedPaths = new Set<string>();
  private expandDepth = 0;
  private pinnedRootPath: string | null = null;
  private mediaMode = false;

  constructor(leaf: WorkspaceLeaf, private plugin: ProjectPlannerPlugin) {
    super(leaf);
  }

  getViewType() { return VIEW_TYPE_PROJECT_DOCUMENTS; }
  getDisplayText() { return "项目文档"; }
  getIcon() { return "folder-tree"; }

  async onOpen() { this.render(); }

  private getActiveProject(): PlannerProject | null {
    return this.plugin.settings.projects.find((p) => p.id === this.plugin.settings.activeProjectId) ?? null;
  }

  private getConfiguredRoot(project: PlannerProject): TFolder | null {
    const configured = project.documentRootPath;
    if (configured) {
      const item = this.app.vault.getAbstractFileByPath(normalizePath(configured));
      if (item instanceof TFolder) return item;
    }
    const base = (this.plugin.settings.projectsBasePath || "Project Planner").trim();
    const fallback = normalizePath(`${base}/${project.storageKey ?? project.name}`);
    const item = this.app.vault.getAbstractFileByPath(fallback);
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

  private hasMatchingDescendant(folder: TFolder): boolean {
    if (!this.query && this.filter === "all") return true;
    return this.filesUnder(folder).length > 0;
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

  private renderTree(host: HTMLElement, root: TFolder) {
    let rendered = 0;
    let truncated = false;

    const columns = host.createDiv("planner-docs-tree-columns");
    columns.createSpan({ text: "名称", cls: "planner-docs-column-name" });
    columns.createSpan({ text: "内容数量", cls: "planner-docs-column-count" });
    columns.createSpan({ text: "修改日期", cls: "planner-docs-column-date" });
    columns.createSpan({ text: "固定", cls: "planner-docs-column-pin" });

    const walk = (folder: TFolder, depth: number) => {
      if (rendered >= MAX_RENDERED_ROWS) { truncated = true; return; }
      const children = [...folder.children]
        .filter((child) => child instanceof TFile ? this.fileMatches(child) : this.hasMatchingDescendant(child as TFolder))
        .sort((a, b) => {
          if (a instanceof TFolder && b instanceof TFile) return -1;
          if (a instanceof TFile && b instanceof TFolder) return 1;
          return a.name.localeCompare(b.name, "zh-CN", { numeric: true });
        });

      for (const child of children) {
        if (rendered++ >= MAX_RENDERED_ROWS) { truncated = true; return; }
        if (child instanceof TFolder) {
          const expanded = this.expandedPaths.has(child.path) || depth < this.expandDepth;
          const count = this.nestedCounts ? this.nestedCount(child) : this.directCount(child);
          const row = host.createDiv("planner-docs-tree-row planner-docs-folder-row");
          row.style.paddingLeft = `${12 + depth * 20}px`;
          const toggle = row.createEl("button", { cls: "planner-docs-tree-toggle", title: expanded ? "收起" : "展开" });
          setIcon(toggle, expanded ? "chevron-down" : "chevron-right");
          const folderIcon = row.createSpan("planner-docs-tree-icon");
          setIcon(folderIcon, expanded ? "folder-open" : "folder");
          row.createSpan({ text: child.name, cls: "planner-docs-tree-name" });
          row.createSpan({ text: `${count.folders} 个文件夹 · ${count.files} 个文件`, cls: "planner-docs-tree-count" });
          const pin = row.createEl("button", { cls: "planner-docs-pin", title: "固定为当前浏览根目录" });
          setIcon(pin, "pin");
          pin.onclick = (event) => {
            event.stopPropagation();
            this.pinnedRootPath = child.path;
            this.expandedPaths.clear();
            this.render();
          };
          const toggleFolder = () => {
            if (expanded) this.expandedPaths.delete(child.path);
            else this.expandedPaths.add(child.path);
            this.render();
          };
          toggle.onclick = (event) => { event.stopPropagation(); toggleFolder(); };
          row.onclick = toggleFolder;
          if (expanded) walk(child, depth + 1);
        } else if (child instanceof TFile) {
          const row = host.createDiv("planner-docs-tree-row planner-docs-file-row");
          row.style.paddingLeft = `${40 + depth * 20}px`;
          const icon = row.createSpan("planner-docs-tree-icon");
          setIcon(icon, this.fileIcon(child));
          row.createSpan({ text: child.name, cls: "planner-docs-tree-name" });
          row.createSpan({ text: new Date(child.stat.mtime).toLocaleDateString("zh-CN"), cls: "planner-docs-tree-date" });
          row.onclick = () => void this.openFile(child);
        }
      }
    };

    walk(root, 0);
    if (truncated) {
      host.createDiv({
        cls: "planner-docs-limit-notice",
        text: `为保证页面流畅，目前最多显示 ${MAX_RENDERED_ROWS} 项。请固定较小的文件夹或使用搜索和类型筛选。`,
      });
    }
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

  private renderRecent(host: HTMLElement, root: TFolder) {
    const recent = this.filesUnder(root).sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, 10);
    const section = host.createDiv("planner-docs-recent");
    section.createEl("h3", { text: "最近更新" });
    if (recent.length === 0) {
      section.createDiv({ text: "当前范围内没有文件。", cls: "planner-docs-empty" });
      return;
    }
    recent.forEach((file) => {
      const row = section.createDiv("planner-docs-recent-row");
      const icon = row.createSpan("planner-docs-tree-icon");
      setIcon(icon, this.fileIcon(file));
      row.createSpan({ text: file.name, cls: "planner-docs-recent-name" });
      row.createSpan({ text: new Date(file.stat.mtime).toLocaleDateString("zh-CN"), cls: "planner-docs-tree-date" });
      row.onclick = () => void this.openFile(file);
    });
  }

  private render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("planner-documents-wrapper");

    renderPlannerHeader(container, this.plugin, {
      active: "documents",
      hideAddTask: true,
      onProjectChange: () => {
        this.pinnedRootPath = null;
        this.expandedPaths.clear();
        this.render();
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
    headingText.createDiv({ text: "查看当前项目的文件、文件夹与最近更新", cls: "planner-docs-subtitle" });
    headingText.createDiv({ text: root.path, cls: "planner-docs-root-path" });
    const headingActions = heading.createDiv("planner-docs-heading-actions");
    if (this.pinnedRootPath) {
      const resetRoot = headingActions.createEl("button", { text: "返回项目根目录" });
      resetRoot.onclick = () => { this.pinnedRootPath = null; this.render(); };
    }
    const setRoot = headingActions.createEl("button", { text: "设置目录" });
    setRoot.onclick = () => new DocumentRootModal(this.plugin, project, () => {
      this.pinnedRootPath = null;
      this.render();
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
    filter.onchange = () => { this.filter = filter.value as FileFilter; this.render(); };

    const search = toolbar.createEl("input", { type: "search", placeholder: "搜索文件和文件夹…", cls: "planner-docs-search" });
    search.value = this.query;
    search.onkeydown = (event) => { if (event.key === "Enter") { this.query = search.value; this.render(); } };
    search.onblur = () => { if (this.query !== search.value) { this.query = search.value; this.render(); } };

    const counts = toolbar.createEl("button", { text: this.nestedCounts ? "数量：包含下级" : "数量：仅当前层", cls: this.nestedCounts ? "planner-docs-count-control active" : "planner-docs-count-control" });
    counts.onclick = () => { this.nestedCounts = !this.nestedCounts; this.render(); };

    const depthGroup = toolbar.createDiv("planner-docs-depth-group");
    const collapse = depthGroup.createEl("button", { text: "收起", cls: this.expandDepth === 0 ? "active" : "" });
    collapse.onclick = () => { this.expandDepth = 0; this.expandedPaths.clear(); this.render(); };
    [1, 2, 3].forEach((level) => {
      const button = depthGroup.createEl("button", { text: `${level} 层`, cls: this.expandDepth === level ? "active" : "" });
      button.onclick = () => { this.expandDepth = level; this.expandedPaths.clear(); this.render(); };
    });
    const expandAll = depthGroup.createEl("button", { text: "全部", cls: this.expandDepth >= 99 ? "active" : "" });
    expandAll.onclick = () => { this.expandDepth = 99; this.expandedPaths.clear(); this.render(); };

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
    const recentThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentCount = matchingFiles.filter((file) => file.stat.mtime >= recentThreshold).length;
    const recentStat = stats.createDiv("planner-docs-stat-card");
    recentStat.createDiv({ text: String(recentCount), cls: "planner-docs-stat-value" });
    recentStat.createDiv({ text: "近 7 天更新", cls: "planner-docs-stat-label" });

    const browser = container.createDiv("planner-docs-browser");
    const browserHeader = browser.createDiv("planner-docs-browser-header");
    const browserTabs = browserHeader.createDiv("planner-docs-browser-tabs");
    browserTabs.createEl("strong", { text: "项目文件" });
    const treeTab = browserTabs.createEl("button", { text: "目录树", cls: !this.mediaMode ? "active" : "" });
    treeTab.onclick = () => { this.mediaMode = false; this.render(); };
    const mediaTab = browserTabs.createEl("button", { text: "附件预览", cls: this.mediaMode ? "active" : "" });
    mediaTab.onclick = () => { this.mediaMode = true; this.render(); };
    const headerMedia = browserHeader.createEl("button", { cls: "planner-docs-browser-mode", title: this.mediaMode ? "切换到目录树" : "切换到附件预览" });
    setIcon(headerMedia, this.mediaMode ? "list-tree" : "layout-grid");
    headerMedia.onclick = () => { this.mediaMode = !this.mediaMode; this.render(); };
    if (this.mediaMode) this.renderMedia(browser, root);
    else this.renderTree(browser, root);
    this.renderRecent(container, root);
  }
}
