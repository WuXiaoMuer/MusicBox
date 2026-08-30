import { state, persist, notify, DEFAULT_SETTINGS } from "./state.js";
import { api, convertFileSrc } from "./api.js";
import { el, toast } from "./ui.js";
import { SHORTCUT_ACTIONS, getKeybinding, setKeybinding, formatCombo, comboFromEvent } from "./shortcuts.js";

const ACCENTS = [
  "#1db954",
  "#3b82f6",
  "#8b5cf6",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#eab308",
];

const DENSITIES = [
  { id: "compact", label: "紧凑" },
  { id: "normal", label: "标准" },
  { id: "loose", label: "宽松" },
];

export function applySettings() {
  const s = state.settings;
  const accent = s.accentColor || "#1db954";
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-hover", lighten(accent, 0.12));
  document.documentElement.dataset.theme = s.theme || "dark";

  const sidebarW = { narrow: "190px", standard: "230px", wide: "280px" }[s.sidebarWidth] || "230px";
  document.documentElement.style.setProperty("--sidebar-w", sidebarW);

  const alpha = { opaque: 1, semi: 0.62, clear: 0.38 }[s.transparency];
  document.documentElement.style.setProperty("--panel-alpha", alpha == null ? 1 : alpha);
  const blur = { light: "14px", standard: "28px", strong: "48px" }[s.glassBlur] || "28px";
  document.documentElement.style.setProperty("--glass-blur", blur);
  document.body.classList.toggle("glass", !!s.glass);

  document.body.classList.remove("density-compact", "density-normal", "density-loose");
  document.body.classList.add("density-" + (s.density || "normal"));
  document.body.classList.toggle("hide-backdrop", !s.showBackdrop);

  document.body.classList.remove("cover-square", "cover-round");
  if (s.coverShape === "square") document.body.classList.add("cover-square");
  else if (s.coverShape === "round") document.body.classList.add("cover-round");

  document.body.classList.toggle("hide-album", !s.showAlbum);

  // 动效
  document.body.classList.toggle("no-anim", !s.animations);
  const speed = { slow: 1.6, normal: 1, fast: 0.6 }[s.animSpeed] || 1;
  document.documentElement.style.setProperty("--anim-speed", speed);
  document.body.classList.toggle("spin-off", !s.coverSpin);
  document.body.classList.toggle("sidebar-hidden", !s.sidebarVisible);
  document.body.classList.toggle("custom-bg", !!s.bgImage);
}

function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + Math.round(255 * amt));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amt));
  const b = Math.min(255, (n & 0xff) + Math.round(255 * amt));
  return `rgb(${r}, ${g}, ${b})`;
}

function segBuilder(options, getValue, setValue) {
  const row = el("div", { class: "seg-row" });
  function render() {
    row.innerHTML = "";
    for (const o of options) {
      const btn = el("button", {
        class: "seg-btn" + (getValue() === o.id ? " active" : ""),
        text: o.label,
      });
      btn.addEventListener("click", () => {
        setValue(o.id);
        applySettings();
        persist();
        render();
      });
      row.append(btn);
    }
  }
  render();
  return row;
}

let mask = null;

function settingRow(label, control) {
  return el("div", { class: "sp-row" }, [
    el("span", { class: "sp-label", text: label }),
    el("div", { class: "sp-control" }, [control]),
  ]);
}

function section(title, rows) {
  return el("section", { class: "sp-section" }, [
    el("h3", { class: "sp-title", text: title }),
    ...rows,
  ]);
}

function switchWrap(input) {
  return el("label", { class: "switch-wrap" }, [input, el("span", { class: "switch-track" })]);
}

function boolSwitch(key, onChange) {
  const input = el("input", { type: "checkbox", class: "switch" });
  input.checked = !!state.settings[key];
  input.addEventListener("change", () => {
    state.settings[key] = input.checked;
    onChange && onChange(input.checked);
    persist();
    applySettings();
  });
  return switchWrap(input);
}

function buildBgControl() {
  const preview = el("img", { class: "bg-preview" });
  if (state.settings.bgImage) preview.src = convertFileSrc(state.settings.bgImage);
  const btns = el("div", { class: "io-btns" }, [
    el("button", {
      class: "io-btn",
      onclick: async () => {
        const p = await api.pickImage();
        if (p) {
          state.settings.bgImage = p;
          preview.src = convertFileSrc(p);
          applySettings();
          persist();
          toast("已设置背景图片");
        }
      },
    }, [
      el("svg", { viewBox: "0 0 24 24", class: "ic" }, [
        el("path", { d: "M4 4h16v16H4z" }),
        el("circle", { cx: "9", cy: "9", r: "1.5" }),
        el("path", { d: "m5 18 5-5 3 3 3-3 3 3" }),
      ]),
      "选择图片",
    ]),
    el("button", {
      class: "io-btn",
      onclick: () => {
        state.settings.bgImage = "";
        preview.removeAttribute("src");
        applySettings();
        persist();
        toast("已清除背景图片");
      },
    }, "清除"),
  ]);
  return el("div", { class: "bg-edit" }, [preview, btns]);
}

const THEMES = [
  { id: "dark", label: "暗色" },
  { id: "light", label: "亮色" },
  { id: "warm", label: "暖色" },
];
const SHAPES = [
  { id: "rounded", label: "圆角" },
  { id: "square", label: "方形" },
  { id: "round", label: "圆形" },
];
const SIDEBAR = [
  { id: "narrow", label: "窄" },
  { id: "standard", label: "标准" },
  { id: "wide", label: "宽" },
];
const TRANSPARENCY = [
  { id: "opaque", label: "不透明" },
  { id: "semi", label: "半透明" },
  { id: "clear", label: "高透明" },
];
const BLUR = [
  { id: "light", label: "轻" },
  { id: "standard", label: "标准" },
  { id: "strong", label: "强" },
];
const ANIM_SPEEDS = [
  { id: "slow", label: "慢" },
  { id: "normal", label: "标准" },
  { id: "fast", label: "快" },
];

export function openSettings() {
  closeSettings();

  const swatchRow = el("div", { class: "swatch-row" });
  function renderSwatches() {
    swatchRow.innerHTML = "";
    for (const c of ACCENTS) {
      const sw = el("button", {
        class: "swatch" + (state.settings.accentColor === c ? " active" : ""),
        title: c,
      });
      sw.style.background = c;
      sw.addEventListener("click", () => {
        state.settings.accentColor = c;
        customColor.value = c;
        applySettings();
        persist();
        renderSwatches();
      });
      swatchRow.append(sw);
    }
  }
  renderSwatches();

  const customColor = el("input", { type: "color", class: "color-input", value: state.settings.accentColor || "#1db954" });
  customColor.addEventListener("input", () => {
    state.settings.accentColor = customColor.value;
    applySettings();
    persist();
    renderSwatches();
  });

  // 音乐文件夹管理
  const folderList = el("div", { class: "folder-list" });
  function renderFolders() {
    folderList.innerHTML = "";
    if (!state.folders.length) {
      folderList.append(el("div", { class: "folder-empty", text: "暂无音乐文件夹" }));
    }
    for (const f of state.folders) {
      const item = el("div", { class: "folder-item" }, [
        el("span", { class: "folder-path", text: f }),
        el("button", {
          class: "folder-rm",
          text: "移除",
          onclick: () => {
            state.folders = state.folders.filter((x) => x !== f);
            const prefix = f.replace(/[\\/]+$/, "").toLowerCase();
            state.tracks = state.tracks.filter((t) => {
              const p = t.path.toLowerCase();
              return !(p.startsWith(prefix + "\\") || p.startsWith(prefix + "/"));
            });
            state.trackMap = new Map(state.tracks.map((t) => [t.path, t]));
            persist();
            notify();
            renderFolders();
            toast("已移除文件夹");
          },
        }),
      ]);
      folderList.append(item);
    }
  }
  renderFolders();

  // 快捷键列表
  const shortcutList = el("div", { class: "shortcut-list" });
  function renderShortcuts() {
    shortcutList.innerHTML = "";
    for (const a of SHORTCUT_ACTIONS) {
      const btn = el("button", { class: "shortcut-key", text: formatCombo(getKeybinding(a.id)) });
      btn.addEventListener("click", () => captureKey(btn, a.id, renderShortcuts));
      shortcutList.append(
        el("div", { class: "shortcut-row" }, [
          el("span", { class: "shortcut-label", text: a.label }),
          btn,
        ])
      );
    }
  }
  renderShortcuts();

  const appearance = section("外观", [
    settingRow("主题色", el("div", { class: "accent-edit" }, [swatchRow, customColor])),
    settingRow("外观主题", segBuilder(THEMES, () => state.settings.theme, (v) => (state.settings.theme = v))),
    settingRow("列表密度", segBuilder(DENSITIES, () => state.settings.density, (v) => (state.settings.density = v))),
    settingRow("封面形状", segBuilder(SHAPES, () => state.settings.coverShape, (v) => (state.settings.coverShape = v))),
    settingRow("侧栏宽度", segBuilder(SIDEBAR, () => state.settings.sidebarWidth, (v) => (state.settings.sidebarWidth = v))),
    settingRow("封面背景", boolSwitch("showBackdrop")),
    settingRow("自定义背景", buildBgControl()),
    settingRow("显示专辑列", boolSwitch("showAlbum")),
  ]);

  const effects = section("特效与动效", [
    settingRow("毛玻璃模糊", boolSwitch("glass")),
    settingRow("模糊强度", segBuilder(BLUR, () => state.settings.glassBlur, (v) => (state.settings.glassBlur = v))),
    settingRow("面板透明度", segBuilder(TRANSPARENCY, () => state.settings.transparency, (v) => (state.settings.transparency = v))),
    settingRow("界面动效", boolSwitch("animations")),
    settingRow("动效速度", segBuilder(ANIM_SPEEDS, () => state.settings.animSpeed, (v) => (state.settings.animSpeed = v))),
    settingRow("封面旋转", boolSwitch("coverSpin")),
  ]);

  const system = section("系统", [
      el("div", { class: "setting-group" }, [
        el("div", { class: "setting-label", text: "音乐文件夹" }),
        folderList,
        el("button", {
          class: "folder-add-btn",
          onclick: async () => {
            const dir = await api.pickFolder();
            if (dir && !state.folders.includes(dir)) {
              state.folders.push(dir);
              await api.allowPaths([dir]);
              const tracks = await api.scanFolders([dir]);
              addTracksLocal(tracks);
              persist();
              renderFolders();
              toast(`已添加 ${tracks.length} 首歌曲`);
            }
          },
        }, [
          el("svg", { viewBox: "0 0 24 24", class: "ic" }, [el("path", { d: "M12 5v14M5 12h14" })]),
          "添加音乐文件夹",
        ]),
      ]),
    settingRow("关闭时最小化到托盘", boolSwitch("minimizeToTray", (v) => api.setCloseToTray(v))),
    settingRow("窗口置顶", boolSwitch("alwaysOnTop", (v) => api.setAlwaysOnTop(v))),
    el("div", { class: "setting-group row" }, [
      el("span", { class: "setting-label", text: "设置" }),
      el("div", { class: "io-btns" }, [
        el("button", { class: "io-btn", onclick: () => exportSettingsJson() }, [
          el("svg", { viewBox: "0 0 24 24", class: "ic" }, [el("path", { d: "M12 15V3" }), el("path", { d: "m7 8 5-5 5 5" }), el("path", { d: "M4 19h16" })]),
          "导出",
        ]),
        el("button", { class: "io-btn", onclick: () => importSettingsJson() }, [
          el("svg", { viewBox: "0 0 24 24", class: "ic" }, [el("path", { d: "M12 3v12" }), el("path", { d: "m7 10 5 5 5-5" }), el("path", { d: "M4 19h16" })]),
          "导入",
        ]),
      ]),
    ]),
  ]);

  const shortcuts = section("快捷键", [
    shortcutList,
    el("div", { class: "shortcut-hint", text: "点击右侧按键，再按下新的组合键即可修改。按 Esc 取消。" }),
  ]);

  const about = section("关于", [
    el("div", { class: "about-logo", text: "♪" }),
    el("div", { class: "about-name", text: "MusicBox" }),
    el("div", { class: "about-desc", text: "一个现代化、跨平台的桌面音乐播放器，基于 Tauri 2 构建。" }),
    el("div", { class: "about-row" }, [el("span", { class: "about-label", text: "版本" }), el("span", { text: "0.1.0" })]),
    el("div", { class: "about-row" }, [el("span", { class: "about-label", text: "开发者" }), el("span", { text: "WuXiaoMu" })]),
    el("div", { class: "about-row" }, [
      el("span", { class: "about-label", text: "GitHub" }),
      el("a", { class: "about-link", text: "github.com/WuXiaoMu", onclick: () => api.openUrl("https://github.com/WuXiaoMu").catch(() => {}) }),
    ]),
  ]);

  const sections = { appearance, effects, system, shortcuts, about };

  function switchSection(id) {
    for (const [k, sec] of Object.entries(sections)) {
      sec.style.display = k === id ? "" : "none";
    }
    nav.querySelectorAll(".sp-nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
  }

  const nav = el("nav", { class: "sp-nav" }, [
    ...["appearance", "effects", "system", "shortcuts", "about"].map((id, i) => {
      const labels = { appearance: "外观", effects: "特效与动效", system: "系统", shortcuts: "快捷键", about: "关于" };
      const b = el("button", { class: "sp-nav-btn" + (i === 0 ? " active" : ""), text: labels[id] });
      b.dataset.id = id;
      b.addEventListener("click", () => switchSection(id));
      return b;
    }),
  ]);

  const page = el("div", { class: "settings-page" }, [
    el("header", { class: "sp-header" }, [
      el("button", { class: "sp-back", onclick: closeSettings }, [
        el("svg", { viewBox: "0 0 24 24", class: "ic" }, [el("path", { d: "M15 18l-6-6 6-6" })]),
        "返回",
      ]),
      el("h2", { text: "设置" }),
    ]),
    el("div", { class: "sp-body" }, [
      nav,
      el("div", { class: "sp-content" }, [appearance, effects, system, shortcuts, about]),
    ]),
  ]);

  mask = el("div", { class: "settings-mask" });
  mask.append(page);
  document.body.append(mask);
  document.body.classList.add("settings-open");
  switchSection("appearance");
}

function captureKey(btn, action, refresh) {
  const original = formatCombo(getKeybinding(action));
  btn.textContent = "请按新快捷键...";
  btn.classList.add("recording");
  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.removeEventListener("keydown", handler, true);
    if (e.code === "Escape") {
      refresh();
      return;
    }
    const combo = comboFromEvent(e);
    if (combo !== getKeybinding(action)) {
      setKeybinding(action, combo);
      persist();
    }
    refresh();
  };
  document.addEventListener("keydown", handler, true);
}

function addTracksLocal(tracks) {
  let added = 0;
  for (const t of tracks) {
    if (!state.trackMap.has(t.path)) {
      state.trackMap.set(t.path, t);
      state.tracks.push(t);
      added++;
    }
  }
  notify();
}

async function exportSettingsJson() {
  try {
    const saved = await api.exportSettings(JSON.stringify(state.settings, null, 2));
    if (saved) toast("设置已导出");
  } catch {
    toast("导出失败");
  }
}

async function importSettingsJson() {
  try {
    const content = await api.importSettings();
    if (!content) return;
    const parsed = JSON.parse(content);
    state.settings = { ...DEFAULT_SETTINGS, ...parsed };
    applySettings();
    persist();
    notify();
    toast("设置已导入");
  } catch {
    toast("导入失败：文件格式不正确");
  }
}

export function closeSettings() {
  if (mask) {
    mask.remove();
    mask = null;
    document.body.classList.remove("settings-open");
  }
}
