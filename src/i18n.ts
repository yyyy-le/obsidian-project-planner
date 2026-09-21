/**
 * Chinese UI layer.
 *
 * The planner stores status/priority values in English and uses those values in
 * scheduling and reporting logic. Translating the rendered DOM instead of the
 * persisted values keeps existing vaults compatible while presenting a fully
 * Chinese interface.
 */
const ZH: Record<string, string> = {
  "Project Planner": "项目计划",
  "Project Planner Settings": "项目计划设置",
  "My Project": "我的项目",
  "No projects": "暂无项目",
  "Dashboard": "仪表盘",
  "My Tasks": "我的任务",
  "Grid": "任务表",
  "Board": "看板",
  "Timeline": "时间线",
  "Add Task": "添加任务",
  "New Task": "新建任务",
  "Columns": "列设置",
  "Show / hide columns": "显示或隐藏列",
  "Open plugin settings": "打开插件设置",
  "Status:": "状态：",
  "Priority:": "优先级：",
  "All": "全部",
  "Search tasks...": "搜索任务…",
  "Clear all filters": "清除全部筛选",
  "Title": "任务名称",
  "Status": "状态",
  "Priority": "优先级",
  "Bucket": "分组",
  "Tags": "标签",
  "Deps": "依赖",
  "Start Date": "开始日期",
  "Due Date": "截止日期",
  "Created": "创建日期",
  "Modified": "修改日期",
  "% Complete": "完成度",
  "Effort Done": "已投入工时",
  "Effort Left": "剩余工时",
  "Effort Total": "总工时",
  "Duration": "持续时间",
  "Est. Cost": "预计成本",
  "Actual Cost": "实际成本",
  "Not Started": "未开始",
  "In Progress": "进行中",
  "Blocked": "已阻塞",
  "Completed": "已完成",
  "Low": "低",
  "Medium": "中",
  "High": "高",
  "Critical": "紧急",
  "Unassigned": "未分组",
  "Today": "今天",
  "Week": "本周",
  "Month": "本月",
  "This Week": "本周",
  "Add to My Day": "添加到今日任务",
  "Add Tasks to My Day": "添加任务到今日",
  "Add Tasks": "添加已有任务",
  "Show completed": "显示已完成",
  "No tasks due today": "今天没有到期任务",
  "Tasks with today's date as their due date will appear here.": "截止日期为今天的任务会显示在这里。",
  "All tasks filtered out": "所有任务都被当前筛选条件隐藏了",
  "No due date": "无截止日期",
  "Add": "添加",
  "Task Title": "任务名称",
  "Description": "说明",
  "Project": "项目",
  "Checklist": "检查清单",
  "Card Preview": "卡片预览",
  "Dependencies": "依赖任务",
  "Links & Attachments": "链接和附件",
  "Copy Link": "复制链接",
  "No task selected.": "尚未选择任务。",
  "No description": "暂无说明",
  "No dependencies": "暂无依赖任务",
  "Select task...": "选择任务…",
  "Finish-to-Start": "完成后开始",
  "Start-to-Start": "同时开始",
  "Finish-to-Finish": "同时完成",
  "Start-to-Finish": "开始后完成",
  "Add Link": "添加链接",
  "No links or attachments": "暂无链接或附件",
  "No tags assigned": "尚未分配标签",
  "Add tag...": "添加标签…",
  "Effort": "工时",
  "Completed hours": "已完成工时",
  "Remaining": "剩余",
  "Total": "合计",
  "hours": "小时",
  "Cost": "成本",
  "Cost Type:": "成本类型：",
  "None": "无",
  "Fixed": "固定金额",
  "Hourly": "按小时",
  "Estimated": "预计",
  "Actual": "实际",
  "Variance": "差额",
  "Hourly Rate:": "每小时费率：",
  "Refresh": "刷新",
  "Reset Layout": "重置布局",
  "Zoom:": "缩放：",
  "Go to date": "跳转到日期",
  "Go": "跳转",
  "Cancel": "取消",
  "No tasks match current filters.": "没有符合当前筛选条件的任务。",
  "No tasks found": "没有找到任务",
  "Completion Progress": "完成进度",
  "Effort Summary": "工时汇总",
  "Budget & Cost": "预算与成本",
  "View Cost Report": "查看成本报告",
  "Cost Report": "成本报告",
  "Show All Projects": "显示所有项目",
  "No projects found.": "没有找到项目。",
  "No active project selected.": "尚未选择当前项目。",
  "Total Tasks": "任务总数",
  "Overdue": "已逾期",
  "Due Today": "今天到期",
  "Due This Week": "本周到期",
  "Critical Priority": "紧急任务",
  "High Priority": "高优先级",
  "Has Dependencies": "存在依赖",
  "Total Effort": "总工时",
  "Avg % Complete": "平均完成度",
  "Budget": "预算",
  "Over Budget": "超出预算",
  "Projects": "项目",
  "Add project": "添加项目",
  "Default view": "默认视图",
  "Grid view": "任务表",
  "Board view": "看板",
  "Timeline (Gantt) view": "时间线（甘特图）",
  "Dashboard view": "仪表盘",
  "Date format": "日期格式",
  "Ribbon icons": "侧边栏图标",
  "Markdown sync": "Markdown 同步",
  "Dependency scheduling": "依赖任务排期",
  "Parent task roll-up": "父任务汇总",
  "Daily note task tagging": "每日笔记任务标签",
  "Actions": "操作",
  "Statuses": "状态",
  "Priorities": "优先级",
  "Changelog": "更新日志",
  "Sync Now": "立即同步",
  "Scan notes": "扫描笔记",
  "Open graph": "打开关系图",
  "Create notes": "创建任务笔记",
  "Add tag": "添加标签",
  "Add status": "添加状态",
  "Add priority": "添加优先级",
  "Task link copied to clipboard": "任务链接已复制",
  "Failed to copy link": "复制链接失败",
  "Creating task note...": "正在创建任务笔记…",
  "Failed to open task note": "无法打开任务笔记"
};

const PHRASES: Array<[RegExp, string]> = [
  [/^(\d+) tasks? due today$/, "今天到期：$1 项"],
  [/^(\d+) tasks?$/, "$1 项任务"],
  [/^Created:\s*/, "创建："],
  [/^Last Updated:\s*/, "最近更新："],
  [/^Open /, "打开"],
  [/^No /, "暂无"],
];

function translateText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;
  let translated = ZH[trimmed];
  if (!translated) {
    translated = trimmed;
    for (const [pattern, replacement] of PHRASES) {
      if (pattern.test(translated)) {
        translated = translated.replace(pattern, replacement);
        break;
      }
    }
  }
  if (translated === trimmed) return value;
  const start = value.slice(0, value.indexOf(trimmed));
  const end = value.slice(value.indexOf(trimmed) + trimmed.length);
  return start + translated + end;
}

function translateElement(root: ParentNode): void {
  const elements: Element[] = [];
  if (root instanceof Element) elements.push(root);
  elements.push(...Array.from(root.querySelectorAll("*")));

  for (const el of elements) {
    for (const attr of ["title", "placeholder", "aria-label"]) {
      const value = el.getAttribute(attr);
      if (value) el.setAttribute(attr, translateText(value));
    }
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        // An <option> without an explicit value derives its value from its
        // text. Preserve the original application value before translating
        // the visible label, otherwise selecting “进行中” would persist the
        // Chinese label instead of the canonical "In Progress" value.
        if (el instanceof HTMLOptionElement && !el.hasAttribute("value")) {
          el.setAttribute("value", node.textContent.trim());
        }
        node.textContent = translateText(node.textContent);
      }
    }
  }
}

export function startChineseUi(): () => void {
  const selector = '[class*="planner-"], [class*="dashboard-"], [class*="myday-"], [data-project-planner-zh]';
  const translateIfPlanner = (node: Element): void => {
    if (node.textContent?.includes("Project Planner Settings")) {
      const settingsRoot = node.closest(".vertical-tab-content") ?? node;
      settingsRoot.setAttribute("data-project-planner-zh", "true");
      translateElement(settingsRoot);
      return;
    }
    const scope = node.matches(selector)
      ? node
      : node.closest(selector) ?? node.querySelector(selector);
    if (scope) translateElement(scope);
  };
  document.querySelectorAll(selector).forEach((el) => translateElement(el));
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof Element) translateIfPlanner(node);
        else if (
          node.nodeType === Node.TEXT_NODE &&
          node.textContent &&
          node.parentElement?.closest(selector)
        ) {
          node.textContent = translateText(node.textContent);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
