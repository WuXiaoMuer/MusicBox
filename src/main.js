import { api, convertFileSrc } from "./js/api.js";
import { state, DEFAULT_SETTINGS, subscribe, addTracks, persist, notify, pushSearchHistory, currentTrack } from "./js/state.js";
import { toast, showContextMenu, el } from "./js/ui.js";
import * as player from "./js/audio.js";
import * as lyrics from "./js/lyrics.js";
import * as queue from "./js/queue.js";
import * as settings from "./js/settings.js";
import * as sleepTimer from "./js/timer.js";
import { renderTrackList, playFromCurrentView, shufflePlay, clearSelection } from "./js/library.js";
import { renderPlaylistSidebar, createPlaylist } from "./js/playlists.js";
import { initShortcuts } from "./js/shortcuts.js";

async function bootstrap() {
  // 1. 加载持久化状态
  let saved = {};
  try {
    saved = await api.loadState();
  } catch (e) {
    console.error("读取状态失败", e);
  }
  state.folders = saved.folders || [];
  state.playlists = saved.playlists || [];
  state.favorites = saved.favorites || [];
  state.history = saved.history || [];
  state.searchHistory = saved.searchHistory || [];
  state.playCounts = saved.playCounts || {};
  state.settings = { ...DEFAULT_SETTINGS, ...(saved.settings || {}) };

  // 应用个性化设置
  settings.applySettings();
  api.setCloseToTray(state.settings.minimizeToTray !== false);
  if (state.settings.alwaysOnTop) api.setAlwaysOnTop(true);
  updateViewToggleIcon();
  if (state.settings.bgImage) {
    document.getElementById("backdrop-img").src = convertFileSrc(state.settings.bgImage);
  }

  // 2. 初始化播放器与 UI
  player.init();
  wireControls();
  initShortcuts();

  // 3. 渲染
  renderPlaylistSidebar();
  renderTrackList();

  // 4. 重新扫描已添加的文件夹
  if (state.folders.length) {
    toast("正在扫描音乐库…");
    try {
      const tracks = await api.scanFolders(state.folders);
      addTracks(tracks);
    } catch (e) {
      console.error("扫描失败", e);
    }
    renderTrackList();
  }

  // 5. 恢复上次播放会话（不自动播放）
  const session = saved.session || {};
  const curQueue = (session.currentQueue || []).filter((p) => state.trackMap.has(p));
  if (curQueue.length) {
    state.currentQueue = curQueue;
    state.queueIndex = Math.min(session.queueIndex ?? -1, curQueue.length - 1);
    state.nextQueue = (session.nextQueue || []).filter((p) => state.trackMap.has(p));
    const track = state.currentQueue[state.queueIndex];
    if (track) player.loadTrack(track, state.settings.lastPosition || 0);
  } else if (state.settings.lastTrack && state.trackMap.has(state.settings.lastTrack)) {
    player.prepare(state.settings.lastTrack, state.settings.lastPosition || 0);
  }
}

function wireControls() {
  document.getElementById("play-btn").addEventListener("click", () => {
    if (player.hasTrack()) player.toggle();
    else playFromCurrentView(0);
  });
  document.getElementById("prev-btn").addEventListener("click", () => player.prev());
  document.getElementById("next-btn").addEventListener("click", () => player.next());
  document.getElementById("mode-btn").addEventListener("click", () => player.cycleMode());
  document.getElementById("fav-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    player.toggleFavorite();
  });
  document.getElementById("np-area").addEventListener("click", () => lyrics.toggle());
  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    state.settings.sidebarVisible = !state.settings.sidebarVisible;
    settings.applySettings();
    persist();
  });
  document.getElementById("mute-btn").addEventListener("click", () => player.toggleMute());
  document.getElementById("lyrics-btn").addEventListener("click", () => lyrics.toggle());
  document.getElementById("queue-btn").addEventListener("click", () => queue.toggle());
  document.getElementById("mini-btn").addEventListener("click", () => api.toggleMini());

  document.getElementById("sleep-btn").addEventListener("click", (e) => {
    const items = [
      { label: "15 分钟后停止", action: () => sleepTimer.setSleep(15) },
      { label: "30 分钟后停止", action: () => sleepTimer.setSleep(30) },
      { label: "45 分钟后停止", action: () => sleepTimer.setSleep(45) },
      { label: "60 分钟后停止", action: () => sleepTimer.setSleep(60) },
    ];
    if (sleepTimer.isActive()) {
      items.push("sep");
      items.push({ label: "关闭定时器", danger: true, action: () => sleepTimer.cancelSleep() });
    }
    const rect = e.currentTarget.getBoundingClientRect();
    showContextMenu(items, rect.left, rect.top - 8);
  });

  document.getElementById("play-all").addEventListener("click", () => playFromCurrentView(0));
  document.getElementById("shuffle-all").addEventListener("click", () => shufflePlay());
  document.getElementById("clear-history").addEventListener("click", () => {
    state.history = [];
    persist();
    notify();
    toast("已清空最近播放");
  });

  // 正在播放视图内的控制
  window.addEventListener("np:prev", () => player.prev());
  window.addEventListener("np:next", () => player.next());
  window.addEventListener("np:mode", () => player.cycleMode());
  window.addEventListener("np:play", () => {
    if (player.hasTrack()) player.toggle();
    else playFromCurrentView(0);
  });
  window.addEventListener("np:seek", (e) => player.seekTo(e.detail));
  window.addEventListener("np:download", () => {
    const t = currentTrack();
    if (t && t.url) {
      toast("正在下载，请稍候…");
      api
        .downloadUrl(t.url)
        .then((p) => toast(p ? "已下载到本地" : "下载取消"))
        .catch(() => toast("下载失败"));
    }
  });

  // 播放在线链接
  document.getElementById("url-play-btn").addEventListener("click", () => {
    const input = el("input", { class: "edit-input", placeholder: "https://...mp3 或任意音频直链" });
    const mask = el("div", { class: "modal-mask" });
    mask.append(
      el("div", { class: "modal" }, [
        el("h3", { text: "播放在线链接" }),
        el("label", { class: "edit-field" }, [el("span", { text: "音频链接" }), input]),
        el("div", { class: "modal-actions" }, [
          el("button", {
            class: "btn-ok",
            text: "播放",
            onclick: () => {
              player.playUrl(input.value);
              mask.remove();
            },
          }),
          el("button", { class: "btn-ok secondary", text: "取消", onclick: () => mask.remove() }),
        ]),
      ])
    );
    mask.addEventListener("mousedown", (e) => {
      if (e.target === mask) mask.remove();
    });
    document.body.append(mask);
    input.focus();
  });

  const seek = document.getElementById("seek");
  seek.addEventListener("input", () => {
    seek.style.setProperty("--fill", seek.value / 10 + "%");
    player.seekTo(seek.value / 1000);
  });

  const vol = document.getElementById("volume");
  vol.addEventListener("input", () => player.setVolume(vol.value / 100));

  const search = document.getElementById("search");
  search.addEventListener("input", () => {
    state.search = search.value;
    renderTrackList();
  });
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      pushSearchHistory(search.value);
      persist();
      closeSearchHistory();
    } else if (e.key === "Escape") {
      closeSearchHistory();
    }
  });
  search.addEventListener("focus", () => openSearchHistory());
  document.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".search-history") && !e.target.closest(".search-wrap")) {
      closeSearchHistory();
    }
  });

  let historyEl = null;
  function closeSearchHistory() {
    if (historyEl) {
      historyEl.remove();
      historyEl = null;
    }
  }
  function openSearchHistory() {
    closeSearchHistory();
    if (!state.searchHistory.length) return;
    const wrap = document.querySelector(".search-wrap");
    const rect = wrap.getBoundingClientRect();
    historyEl = document.createElement("div");
    historyEl.className = "search-history";
    renderSearchHistoryItems();
    document.body.append(historyEl);
    historyEl.style.left = rect.left + "px";
    historyEl.style.top = rect.bottom + 6 + "px";
    historyEl.style.width = rect.width + "px";
  }
  function renderSearchHistoryItems() {
    historyEl.innerHTML = "";
    const head = document.createElement("div");
    head.className = "sh-head";
    const clearBtn = document.createElement("button");
    clearBtn.className = "sh-clear";
    clearBtn.textContent = "清空";
    clearBtn.addEventListener("click", () => {
      state.searchHistory = [];
      persist();
      closeSearchHistory();
    });
    head.append("搜索历史", clearBtn);
    historyEl.append(head);
    for (const q of state.searchHistory) {
      const item = document.createElement("div");
      item.className = "sh-item";
      const qEl = document.createElement("span");
      qEl.className = "sh-q";
      qEl.textContent = q;
      qEl.addEventListener("click", () => {
        search.value = q;
        state.search = q;
        renderTrackList();
        closeSearchHistory();
      });
      const rm = document.createElement("button");
      rm.className = "sh-remove";
      rm.textContent = "✕";
      rm.addEventListener("click", (e) => {
        e.stopPropagation();
        state.searchHistory = state.searchHistory.filter((x) => x !== q);
        persist();
        renderSearchHistoryItems();
      });
      item.append(qEl, rm);
      historyEl.append(item);
    }
  }

  document.getElementById("sort").addEventListener("change", (e) => {
    state.sort = e.target.value;
    state.sortDir = "asc";
    renderTrackList();
  });

  document.getElementById("view-toggle").addEventListener("click", () => {
    const order = ["list", "album", "artist"];
    const i = order.indexOf(state.settings.libraryView);
    state.settings.libraryView = order[(i + 1) % order.length];
    clearSelection();
    updateViewToggleIcon();
    persist();
    renderTrackList();
  });

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
      btn.classList.add("active");
      state.view = btn.dataset.view;
      clearSelection();
      renderTrackList();
    });
  });

  document.getElementById("new-playlist").addEventListener("click", () => createPlaylist());
  document.getElementById("settings-btn").addEventListener("click", () => settings.openSettings());

  document.getElementById("add-folder").addEventListener("click", addFolder);
  document.getElementById("add-files").addEventListener("click", addFiles);
}

async function addFolder() {
  const folder = await api.pickFolder();
  if (!folder) return;
  if (state.folders.includes(folder)) {
    switchToLibrary();
    toast("该文件夹已在曲库中");
    return;
  }
  state.folders.push(folder);
  await persist();
  toast("正在扫描文件夹…");
  try {
    const tracks = await api.scanFolders([folder]);
    const added = addTracks(tracks);
    switchToLibrary();
    toast(`新增 ${added} 首歌曲`);
  } catch (e) {
    console.error(e);
    toast("扫描失败");
  }
}

async function addFiles() {
  const files = await api.pickFiles();
  if (!files || !files.length) return;
  try {
    await api.allowPaths(files);
    const tracks = await api.readTracks(files);
    const added = addTracks(tracks);
    switchToLibrary();
    toast(`新增 ${added} 首歌曲`);
  } catch (e) {
    console.error(e);
    toast("添加失败");
  }
}

function switchToLibrary() {
  state.view = "library";
  state.search = "";
  const searchEl = document.getElementById("search");
  if (searchEl) searchEl.value = "";
  document.querySelectorAll(".nav-item").forEach((n) => {
    n.classList.toggle("active", n.dataset.view === "library");
  });
  renderTrackList();
  renderPlaylistSidebar();
}

function updateViewToggleIcon() {
  const el = document.getElementById("view-toggle-icon");
  const btn = document.getElementById("view-toggle");
  if (!el) return;
  const icons = {
    list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    album: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v11h-7zM4 13h7v7H4z"/>',
    artist: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/>',
  };
  const labels = { list: "列表视图", album: "专辑视图", artist: "歌手视图" };
  el.innerHTML = icons[state.settings.libraryView] || icons.list;
  if (btn) btn.title = "切换视图（当前：" + (labels[state.settings.libraryView] || "列表") + "）";
}

subscribe(() => {
  renderTrackList();
  renderPlaylistSidebar();
  queue.refresh();
});

bootstrap();
