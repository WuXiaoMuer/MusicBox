import { api } from "./api.js";

export const DEFAULT_SETTINGS = {
  volume: 0.8,
  playMode: "sequence", // sequence | repeatAll | repeatOne | shuffle
  muted: false,
  lastTrack: null,
  lastPosition: 0,
  accentColor: "#1db954", // 主题色
  density: "normal", // compact | normal | loose
  showBackdrop: true, // 封面背景
  theme: "dark", // dark | light
  coverShape: "rounded", // rounded | square | round
  sidebarWidth: "standard", // narrow | standard | wide
  showAlbum: true, // 显示专辑列
  glass: true, // 毛玻璃背景模糊
  transparency: "semi", // opaque | semi | clear
  glassBlur: "standard", // light | standard | strong
  minimizeToTray: true, // 关闭按钮最小化到托盘
  alwaysOnTop: false, // 主窗口置顶
  libraryView: "list", // list | album | artist
  animations: true, // 界面动效
  animSpeed: "normal", // slow | normal | fast
  coverSpin: true, // 封面旋转
  sidebarVisible: true, // 侧栏显示
  keybindings: {}, // 自定义快捷键
};

export const state = {
  tracks: [], // Track[]
  trackMap: new Map(), // path -> Track
  folders: [], // [path]
  playlists: [], // [{id,name,tracks:[path]}]
  favorites: [], // [path]
  settings: { ...DEFAULT_SETTINGS },
  // 运行时 UI 状态
  view: "library", // 'library' | 'favorites' | playlist.id
  currentQueue: [], // [path]
  queueIndex: -1,
  nextQueue: [], // [path] 「下一首播放」
  history: [], // [path] 最近播放，最新在前
  searchHistory: [], // [string] 搜索历史，最新在前
  playCounts: {}, // path -> 次数
  search: "",
  sort: "default",
  sortDir: "asc", // asc | desc
  selection: new Set(), // 批量选择的 path 集合（运行时）
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
}

export function notify() {
  listeners.forEach((fn) => fn());
}

export function currentTrack() {
  const p = state.currentQueue[state.queueIndex];
  return p ? state.trackMap.get(p) : null;
}

export function persist() {
  const payload = {
    folders: state.folders,
    playlists: state.playlists,
    favorites: state.favorites,
    settings: state.settings,
    session: {
      currentQueue: state.currentQueue,
      queueIndex: state.queueIndex,
      nextQueue: state.nextQueue,
    },
    history: state.history,
    searchHistory: state.searchHistory,
    playCounts: state.playCounts,
  };
  return api.saveState(payload).catch((e) => console.error("保存失败", e));
}

export function rebuildTrackMap() {
  state.trackMap = new Map();
  for (const t of state.tracks) state.trackMap.set(t.path, t);
}

export function addTracks(tracks) {
  const existing = new Set(state.tracks.map((t) => t.path));
  let added = 0;
  for (const t of tracks) {
    if (!existing.has(t.path)) {
      state.tracks.push(t);
      existing.add(t.path);
      added++;
    }
  }
  rebuildTrackMap();
  return added;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function pushHistory(path) {
  if (!path) return;
  state.history = [path, ...state.history.filter((p) => p !== path)].slice(0, 100);
}

export function pushSearchHistory(q) {
  const s = q.trim();
  if (!s) return;
  state.searchHistory = [s, ...state.searchHistory.filter((x) => x !== s)].slice(0, 20);
}
