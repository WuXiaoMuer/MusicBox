import { api, listen } from "./api.js";
import { state, addTracks, notify, persist } from "./state.js";
import { toast, el } from "./ui.js";
import * as player from "./audio.js";
import * as lyrics from "./lyrics.js";
import * as queue from "./queue.js";
import { addToPlaylist } from "./playlists.js";
import { playFromCurrentView } from "./library.js";

const AUDIO_RE = /\.(mp3|flac|wav|ogg|m4a|aac|opus|ape)$/i;

export const DEFAULT_KEYBINDINGS = {
  togglePlay: "Space",
  next: "Ctrl+ArrowRight",
  prev: "Ctrl+ArrowLeft",
  seekForward: "ArrowRight",
  seekBack: "ArrowLeft",
  volumeUp: "ArrowUp",
  volumeDown: "ArrowDown",
  mute: "KeyM",
  lyrics: "KeyL",
  queue: "KeyQ",
  favorite: "KeyF",
  lyricBack: "BracketLeft",
  lyricForward: "BracketRight",
  help: "Shift+Slash",
};

export const SHORTCUT_ACTIONS = [
  { id: "togglePlay", label: "播放 / 暂停" },
  { id: "next", label: "下一首" },
  { id: "prev", label: "上一首" },
  { id: "seekForward", label: "快进 5 秒" },
  { id: "seekBack", label: "快退 5 秒" },
  { id: "volumeUp", label: "音量增加" },
  { id: "volumeDown", label: "音量减少" },
  { id: "mute", label: "静音" },
  { id: "lyrics", label: "歌词 / 正在播放" },
  { id: "queue", label: "播放队列" },
  { id: "favorite", label: "收藏当前歌曲" },
  { id: "lyricBack", label: "歌词偏移 -0.5 秒" },
  { id: "lyricForward", label: "歌词偏移 +0.5 秒" },
  { id: "help", label: "快捷键帮助" },
];

export function getKeybinding(action) {
  return (state.settings.keybindings || {})[action] || DEFAULT_KEYBINDINGS[action];
}

export function setKeybinding(action, combo) {
  if (!state.settings.keybindings) state.settings.keybindings = {};
  state.settings.keybindings[action] = combo;
}

export function comboFromEvent(e) {
  const mods = [];
  if (e.ctrlKey || e.metaKey) mods.push("Ctrl");
  if (e.shiftKey) mods.push("Shift");
  if (e.altKey) mods.push("Alt");
  return [...mods, e.code].join("+");
}

const KEY_NAMES = {
  Space: "空格",
  ArrowRight: "→",
  ArrowLeft: "←",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Slash: "/",
  BracketLeft: "[",
  BracketRight: "]",
  Enter: "回车",
  Escape: "Esc",
  Backspace: "退格",
  Tab: "Tab",
};

export function formatCombo(combo) {
  const parts = combo.split("+");
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);
  const keyName = KEY_NAMES[key] || key.replace(/^Key/, "");
  return [...mods, keyName].join(" + ");
}

function execAction(action) {
  switch (action) {
    case "togglePlay":
      if (player.hasTrack()) player.toggle();
      else playFromCurrentView(0);
      break;
    case "next":
      player.next();
      break;
    case "prev":
      player.prev();
      break;
    case "seekForward":
      player.seekBy(5);
      break;
    case "seekBack":
      player.seekBy(-5);
      break;
    case "volumeUp":
      player.volumeBy(0.05);
      break;
    case "volumeDown":
      player.volumeBy(-0.05);
      break;
    case "mute":
      player.toggleMute();
      break;
    case "lyrics":
      lyrics.toggle();
      break;
    case "queue":
      queue.toggle();
      break;
    case "favorite":
      player.toggleFavorite();
      break;
    case "lyricBack":
      {
        const off = lyrics.adjustOffset(-0.5);
        toast(`歌词偏移 ${off > 0 ? "+" : ""}${off}s`);
      }
      break;
    case "lyricForward":
      {
        const off = lyrics.adjustOffset(0.5);
        toast(`歌词偏移 ${off > 0 ? "+" : ""}${off}s`);
      }
      break;
    case "help":
      toggleHelp();
      break;
  }
}

export function initShortcuts() {
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (document.body.classList.contains("settings-open")) return;
    const kb = { ...DEFAULT_KEYBINDINGS, ...(state.settings.keybindings || {}) };
    const actionByCombo = {};
    for (const [action, combo] of Object.entries(kb)) actionByCombo[combo] = action;
    const action = actionByCombo[comboFromEvent(e)];
    if (!action) return;
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    execAction(action);
  });

  listen("drag-drop", (e) => handleDropped(e.payload || []));

  // 系统媒体键 / SMTC 事件
  listen("media-event", (e) => {
    const p = e.payload;
    if (p === "toggle") {
      if (player.hasTrack()) player.toggle();
      else playFromCurrentView(0);
    } else if (p === "next") {
      player.next();
    } else if (p === "prev") {
      player.prev();
    } else if (p === "play") {
      if (!player.isPlaying() && player.hasTrack()) player.toggle();
    } else if (p === "pause") {
      if (player.isPlaying()) player.toggle();
    } else if (typeof p === "string" && p.startsWith("seek:")) {
      player.seekToTime(parseFloat(p.slice(5)));
    }
  });

  // 系统托盘菜单事件
  listen("tray", (e) => {
    const p = e.payload;
    if (p === "toggle") {
      if (player.hasTrack()) player.toggle();
      else playFromCurrentView(0);
    } else if (p === "next") {
      player.next();
    } else if (p === "prev") {
      player.prev();
    }
  });

  // 迷你播放窗控制
  listen("mini-cmd", (e) => {
    const p = e.payload;
    if (p === "toggle") {
      if (player.hasTrack()) player.toggle();
      else playFromCurrentView(0);
    } else if (p === "next") {
      player.next();
    } else if (p === "prev") {
      player.prev();
    }
  });

  // 迷你窗打开时同步当前状态
  listen("mini-opened", () => player.syncMini());
}

async function handleDropped(paths) {
  const files = [];
  const dirs = [];
  for (const p of paths) {
    if (AUDIO_RE.test(p)) files.push(p);
    else dirs.push(p);
  }

  const newPaths = [];
  try {
    if (files.length) {
      await api.allowPaths(files);
      const tracks = await api.readTracks(files);
      newPaths.push(...tracks.map((t) => t.path));
      addTracks(tracks);
    }
    if (dirs.length) {
      await api.allowPaths(dirs);
      const tracks = await api.scanFolders(dirs);
      newPaths.push(...tracks.map((t) => t.path));
      addTracks(tracks);
    }
  } catch (e) {
    console.error(e);
  }

  if (state.view !== "library" && state.view !== "favorites" && newPaths.length) {
    addToPlaylist(state.view, newPaths);
  }

  notify();
  toast(newPaths.length ? `已添加 ${newPaths.length} 首歌曲` : "未识别到音频文件");
}

let helpMask = null;

function toggleHelp() {
  if (helpMask) {
    helpMask.remove();
    helpMask = null;
    return;
  }
  const rows = [
    ["空格", "播放 / 暂停"],
    ["Ctrl + →", "下一首"],
    ["Ctrl + ←", "上一首"],
    ["← / →", "快退 / 快进 5 秒"],
    ["↑ / ↓", "音量增 / 减"],
    ["M", "静音"],
    ["L", "正在播放 / 歌词"],
    ["[ / ]", "歌词偏移 -0.5 / +0.5 秒"],
    ["Q", "播放队列"],
    ["F", "收藏当前歌曲"],
    ["Shift + ?", "快捷键帮助"],
    ["双击歌曲", "播放"],
    ["右键歌曲", "更多操作"],
  ];
  const table = el("div", { class: "help-table" });
  for (const [k, desc] of rows) {
    table.append(
      el("div", { class: "help-row" }, [
        el("span", { class: "help-key", text: k }),
        el("span", { class: "help-desc", text: desc }),
      ])
    );
  }
  helpMask = el("div", { class: "modal-mask" });
  helpMask.append(
    el("div", { class: "modal" }, [
      el("h3", { text: "快捷键" }),
      table,
      el("div", { class: "modal-actions" }, [
        el("button", { class: "btn-ok", text: "知道了", onclick: toggleHelp }),
      ]),
    ])
  );
  helpMask.addEventListener("mousedown", (e) => {
    if (e.target === helpMask) toggleHelp();
  });
  document.body.append(helpMask);
}
