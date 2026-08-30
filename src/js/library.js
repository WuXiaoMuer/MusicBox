import { api } from "./api.js";
import { state, currentTrack, notify, persist, uid } from "./state.js";
import { escapeHtml, fmtTime, showContextMenu, toast } from "./ui.js";
import * as player from "./audio.js";
import { addToPlaylist, removeFromPlaylist, createPlaylist, getPlaylist } from "./playlists.js";

const coverCache = new Map(); // path -> dataURL
const pendingCovers = new Set(); // paths currently being fetched

const coverObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        loadCover(e.target);
        coverObserver.unobserve(e.target);
      }
    }
  },
  { rootMargin: "200px" }
);

function loadCover(img) {
  const path = img.dataset.path;
  if (!path) return;
  if (coverCache.has(path)) {
    img.src = coverCache.get(path);
    return;
  }
  if (pendingCovers.has(path)) return;
  pendingCovers.add(path);
  api
    .getCover(path)
    .then((url) => {
      if (url) {
        coverCache.set(path, url);
        img.src = url;
      }
    })
    .catch(() => {})
    .finally(() => pendingCovers.delete(path));
}

export function currentViewTracks() {
  if (state.view === "library") return state.tracks;
  if (state.view === "favorites") {
    return state.favorites.map((p) => state.trackMap.get(p)).filter(Boolean);
  }
  if (state.view === "history") {
    return state.history.map((p) => state.trackMap.get(p)).filter(Boolean);
  }
  if (state.view === "most") {
    return state.tracks
      .filter((t) => (state.playCounts[t.path] || 0) > 0)
      .sort((a, b) => (state.playCounts[b.path] || 0) - (state.playCounts[a.path] || 0));
  }
  const pl = getPlaylist(state.view);
  if (pl) return pl.tracks.map((p) => state.trackMap.get(p)).filter(Boolean);
  return [];
}

function sortedTracks(list) {
  const arr = [...list];
  const dir = state.sortDir === "desc" ? -1 : 1;
  switch (state.sort) {
    case "title":
      arr.sort((a, b) => a.title.localeCompare(b.title, "zh") * dir);
      break;
    case "artist":
      arr.sort((a, b) => a.artist.localeCompare(b.artist, "zh") * dir);
      break;
    case "album":
      arr.sort((a, b) => a.album.localeCompare(b.album, "zh") * dir);
      break;
    case "duration":
      arr.sort((a, b) => (a.duration - b.duration) * dir);
      break;
    default:
      break;
  }
  return arr;
}

export function renderTrackList() {
  const container = document.getElementById("track-list");
  const emptyHint = document.getElementById("empty-hint");
  const countEl = document.getElementById("track-count");
  const titleEl = document.getElementById("view-title-text");

  const viewTracks = currentViewTracks();
  countEl.textContent = viewTracks.length + " 首";

  // 视图标题
  if (state.view === "library") titleEl.textContent = "音乐库";
  else if (state.view === "favorites") titleEl.textContent = "我喜欢";
  else if (state.view === "history") titleEl.textContent = "最近播放";
  else if (state.view === "most") titleEl.textContent = "最常播放";
  else {
    const pl = getPlaylist(state.view);
    titleEl.textContent = pl ? pl.name : "歌单";
  }

  const clearBtn = document.getElementById("clear-history");
  if (clearBtn) clearBtn.style.display = state.view === "history" ? "" : "none";

  let list = viewTracks;
  const q = state.search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
    );
  }
  list = sortedTracks(list);
  lastDisplayedList = list;

  if (!viewTracks.length) {
    container.style.display = "none";
    emptyHint.style.display = "flex";
    return;
  }
  container.style.display = "";
  emptyHint.style.display = "none";

  if (state.settings.libraryView === "album" || state.settings.libraryView === "artist") {
    renderGrid(container, list, state.settings.libraryView);
    return;
  }

  const cur = currentTrack();
  const curPath = cur ? cur.path : null;

  const rows = list
    .map((t, i) => {
      const playing = t.path === curPath;
      const coverHtml = t.hasCover
        ? `<img class="track-cover" data-path="${escapeHtml(t.path)}" alt="">`
        : `<div class="track-cover placeholder">♪</div>`;
      const idxHtml = playing ? `<span class="eq">♪</span>` : String(i + 1);
      return `<tr class="track-row${playing ? " playing" : ""}" data-path="${escapeHtml(t.path)}">
        <td class="col-index">${idxHtml}</td>
        <td class="col-cover">${coverHtml}</td>
        <td class="col-title">${escapeHtml(t.title)}</td>
        <td class="col-artist">${escapeHtml(t.artist || "未知歌手")}</td>
        <td class="col-album">${escapeHtml(t.album || "未知专辑")}</td>
        <td class="col-duration">${fmtTime(t.duration)}</td>
      </tr>`;
    })
    .join("");

  container.innerHTML =
    `<table><thead><tr>
      <th class="col-index">#</th>
      <th class="col-cover"></th>
      <th class="col-title sortable" data-sort="title">标题${sortArrow("title")}</th>
      <th class="col-artist sortable" data-sort="artist">歌手${sortArrow("artist")}</th>
      <th class="col-album sortable" data-sort="album">专辑${sortArrow("album")}</th>
      <th class="col-duration sortable" data-sort="duration">时长${sortArrow("duration")}</th>
    </tr></thead><tbody>${rows}</tbody></table>`;

  container.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => setSort(th.dataset.sort));
  });

  // 事件委托
  const reorderable = canReorder();
  container.querySelectorAll(".track-row").forEach((row) => {
    const path = row.dataset.path;
    row.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey) {
        toggleSelect(path, row);
      } else if (e.shiftKey) {
        rangeSelect(path);
      } else {
        clearSelection();
      }
    });
    row.addEventListener("dblclick", () => playFromList(path));
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openTrackMenu(path, e.clientX, e.clientY);
    });
    if (reorderable) {
      row.draggable = true;
      row.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", path);
        row.classList.add("dragging");
      });
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData("text/plain");
        if (from && from !== path) moveInPlaylist(from, path);
      });
      row.addEventListener("dragend", () => row.classList.remove("dragging"));
    }
  });
  container.querySelectorAll("img.track-cover").forEach((img) => coverObserver.observe(img));

  // 恢复已选行的视觉状态
  refreshSelectionVisual();
  updateSelectionBar();

  // 自动滚动到正在播放的曲目（仅切换曲目时）
  if (curPath && curPath !== lastScrolledPath) {
    lastScrolledPath = curPath;
    const playingRow = container.querySelector(".track-row.playing");
    if (playingRow) playingRow.scrollIntoView({ block: "nearest" });
  }
}

let lastScrolledPath = null;

function canReorder() {
  return (
    !!getPlaylist(state.view) &&
    !state.search.trim() &&
    state.sort === "default"
  );
}

function moveInPlaylist(fromPath, beforePath) {
  const pl = getPlaylist(state.view);
  if (!pl) return;
  const from = pl.tracks.indexOf(fromPath);
  const to = pl.tracks.indexOf(beforePath);
  if (from < 0 || to < 0 || from === to) return;
  pl.tracks.splice(to, 0, pl.tracks.splice(from, 1)[0]);
  persist();
  renderTrackList();
}

function playFromList(path) {
  const list = sortedTracks(currentViewTracks());
  const idx = list.findIndex((t) => t.path === path);
  if (idx < 0) return;
  player.playQueue(list.map((t) => t.path), idx);
}

function sortArrow(field) {
  if (state.sort !== field) return "";
  return state.sortDir === "desc" ? " ↓" : " ↑";
}

export function setSort(field) {
  if (state.sort === field) {
    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  } else {
    state.sort = field;
    state.sortDir = "asc";
  }
  const sel = document.getElementById("sort");
  if (sel) sel.value = field;
  renderTrackList();
}

/* ===== 批量选择 ===== */
let lastDisplayedList = [];
let lastAnchor = null;
let selectionBarWired = false;

function selectedInOrder() {
  return lastDisplayedList.filter((t) => state.selection.has(t.path)).map((t) => t.path);
}

function toggleSelect(path, row) {
  if (state.selection.has(path)) {
    state.selection.delete(path);
    if (row) row.classList.remove("selected");
  } else {
    state.selection.add(path);
    if (row) row.classList.add("selected");
    lastAnchor = path;
  }
  updateSelectionBar();
}

function rangeSelect(path) {
  const list = lastDisplayedList;
  const from = lastAnchor ? list.findIndex((t) => t.path === lastAnchor) : -1;
  const to = list.findIndex((t) => t.path === path);
  if (from < 0 || to < 0) return;
  const [a, b] = from < to ? [from, to] : [to, from];
  state.selection.clear();
  for (let i = a; i <= b; i++) state.selection.add(list[i].path);
  refreshSelectionVisual();
  updateSelectionBar();
}

export function clearSelection() {
  state.selection.clear();
  refreshSelectionVisual();
  updateSelectionBar();
}

function refreshSelectionVisual() {
  const container = document.getElementById("track-list");
  container.querySelectorAll(".track-row").forEach((row) => {
    row.classList.toggle("selected", state.selection.has(row.dataset.path));
  });
}

function updateSelectionBar() {
  const bar = document.getElementById("selection-bar");
  const n = state.selection.size;
  bar.style.display = n ? "flex" : "none";
  const countEl = document.getElementById("selection-count");
  if (countEl) countEl.textContent = `已选 ${n} 首`;
  const removeBtn = document.getElementById("sel-remove");
  if (removeBtn) removeBtn.style.display = getPlaylist(state.view) ? "" : "none";
  if (!selectionBarWired) wireSelectionBar();
}

function wireSelectionBar() {
  selectionBarWired = true;
  document.getElementById("sel-play").addEventListener("click", () => {
    const paths = selectedInOrder();
    if (paths.length) player.playQueue(paths, 0);
    clearSelection();
  });
  document.getElementById("sel-fav").addEventListener("click", () => {
    let added = 0;
    for (const p of state.selection) {
      if (!state.favorites.includes(p)) {
        state.favorites.push(p);
        added++;
      }
    }
    persist();
    notify();
    clearSelection();
    toast(`已收藏 ${added} 首`);
  });
  document.getElementById("sel-queue").addEventListener("click", () => {
    const idx = state.queueIndex >= 0 ? state.queueIndex + 1 : state.currentQueue.length;
    state.currentQueue.splice(idx, 0, ...state.selection);
    notify();
    clearSelection();
    toast("已加入播放队列");
  });
  document.getElementById("sel-playlist").addEventListener("click", (e) => {
    const paths = [...state.selection];
    const rect = e.currentTarget.getBoundingClientRect();
    showPlaylistPicker(paths, rect.left, rect.top - 8);
  });
  document.getElementById("sel-remove").addEventListener("click", () => {
    const pl = getPlaylist(state.view);
    if (pl) {
      pl.tracks = pl.tracks.filter((p) => !state.selection.has(p));
      persist();
      notify();
      clearSelection();
      toast("已从歌单移除");
    }
  });
  document.getElementById("sel-clear").addEventListener("click", clearSelection);
}

function groupTracks(tracks, mode) {
  const map = new Map();
  for (const t of tracks) {
    const name = mode === "artist" ? t.artist || "未知歌手" : t.album || "未知专辑";
    const sub = mode === "artist" ? t.album || "" : t.artist || "未知歌手";
    const key = mode + "||" + name + "||" + sub;
    if (!map.has(key)) {
      map.set(key, { key, name, sub, tracks: [], coverPath: t.hasCover ? t.path : null });
    }
    const g = map.get(key);
    g.tracks.push(t);
    if (!g.coverPath && t.hasCover) g.coverPath = t.path;
  }
  const groups = [...map.values()];
  groups.sort((a, b) => a.name.localeCompare(b.name, "zh"));
  return groups;
}

function renderGrid(container, list, mode) {
  const groups = groupTracks(list, mode);
  const html = groups
    .map(
      (g) => `
    <div class="album-card" data-key="${escapeHtml(g.key)}">
      <div class="album-cover">
        ${g.coverPath ? `<img data-path="${escapeHtml(g.coverPath)}" alt="">` : `<div class="album-cover-ph">♪</div>`}
        <button class="card-play" title="播放">
          <svg viewBox="0 0 24 24" class="ic"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
      <div class="album-name">${escapeHtml(g.name)}</div>
      <div class="album-artist">${escapeHtml(g.sub)} · ${g.tracks.length} 首</div>
    </div>`
    )
    .join("");
  container.innerHTML = `<div class="album-grid">${html}</div>`;

  container.querySelectorAll(".album-card").forEach((card) => {
    card.addEventListener("click", () => playGroup(mode, card.dataset.key));
  });
  container.querySelectorAll(".album-cover img[data-path]").forEach((img) => coverObserver.observe(img));
}

function playGroup(mode, key) {
  const group = groupTracks(currentViewTracks(), mode).find((g) => g.key === key);
  if (!group || !group.tracks.length) return;
  const tracks = sortedTracks(group.tracks);
  player.playQueue(tracks.map((t) => t.path), 0);
}

export function playFromCurrentView(index) {
  const list = sortedTracks(currentViewTracks());
  if (!list.length) return;
  const i = Math.max(0, Math.min(index, list.length - 1));
  player.playQueue(list.map((t) => t.path), i);
}

export function shufflePlay() {
  const list = sortedTracks(currentViewTracks());
  if (!list.length) return;
  player.setMode("shuffle");
  const i = Math.floor(Math.random() * list.length);
  player.playQueue(list.map((t) => t.path), i);
}

function openTrackMenu(path, x, y) {
  const track = state.trackMap.get(path);
  if (!track) return;

  const inFavorites = state.favorites.includes(path);
  const inPlaylistView = !!getPlaylist(state.view);

  const items = [
    { label: "播放", action: () => player.playSingle(path) },
    {
      label: "下一首播放",
      action: () => {
        state.nextQueue.push(path);
        notify();
        toast("已加入「下一首播放」");
      },
    },
    {
      label: "加入播放队列",
      action: () => {
        const idx = state.queueIndex >= 0 ? state.queueIndex + 1 : state.currentQueue.length;
        state.currentQueue.splice(idx, 0, path);
        notify();
        toast("已加入播放队列");
      },
    },
    "sep",
    {
      label: inFavorites ? "取消收藏" : "添加到「我喜欢」",
      action: () => {
        if (inFavorites) state.favorites = state.favorites.filter((p) => p !== path);
        else state.favorites.push(path);
        persist();
        notify();
      },
    },
    {
      label: "添加到歌单",
      action: () => showPlaylistPicker([path], x, y),
    },
    "sep",
    {
      label: "编辑信息",
      action: () => openEditModal(path),
    },
    {
      label: "打开文件所在位置",
      action: () => api.revealInDir(path).catch(() => toast("打开失败")),
    },
    "sep",
    {
      label: "从曲库移除",
      danger: true,
      action: () => removeTrackFromLibrary(path),
    },
  ];

  if (inPlaylistView) {
    items.push("sep");
    items.push({
      label: "从歌单移除",
      danger: true,
      action: () => {
        removeFromPlaylist(state.view, path);
        toast("已从歌单移除");
      },
    });
  }

  showContextMenu(items, x, y);
}

function showPlaylistPicker(paths, x, y) {
  const items = state.playlists.map((pl) => ({
    label: pl.name,
    action: () => {
      const n = addToPlaylist(pl.id, paths);
      toast(n ? `已添加到「${pl.name}」` : "已在歌单中");
    },
  }));
  items.push("sep");
  items.push({
    label: "＋ 新建歌单",
    action: async () => {
      const prevCount = state.playlists.length;
      await createPlaylist();
      const pl = state.playlists[state.playlists.length - 1];
      if (pl && state.playlists.length > prevCount) addToPlaylist(pl.id, paths);
    },
  });
  showContextMenu(items, x, y);
}

function removeTrackFromLibrary(path) {
  const wasCurrent = state.currentQueue[state.queueIndex] === path;
  state.trackMap.delete(path);
  state.tracks = state.tracks.filter((t) => t.path !== path);
  state.favorites = state.favorites.filter((p) => p !== path);
  state.playlists.forEach((pl) => {
    pl.tracks = pl.tracks.filter((p) => p !== path);
  });
  state.history = state.history.filter((p) => p !== path);
  delete state.playCounts[path];
  state.nextQueue = state.nextQueue.filter((p) => p !== path);
  const qi = state.currentQueue.indexOf(path);
  if (qi >= 0) {
    state.currentQueue.splice(qi, 1);
    if (qi < state.queueIndex) state.queueIndex--;
  }
  if (wasCurrent) player.stop();
  persist();
  notify();
  toast("已从曲库移除");
}

async function openEditModal(path) {
  const t = state.trackMap.get(path);
  if (!t) return;
  const titleInput = el("input", { class: "edit-input", value: t.title });
  const artistInput = el("input", { class: "edit-input", value: t.artist || "" });
  const albumInput = el("input", { class: "edit-input", value: t.album || "" });

  const field = (label, input) =>
    el("label", { class: "edit-field" }, [el("span", { text: label }), input]);

  const modal = el("div", { class: "modal" }, [
    el("h3", { text: "编辑歌曲信息" }),
    field("标题", titleInput),
    field("歌手", artistInput),
    field("专辑", albumInput),
    el("div", { class: "modal-actions" }, [
      el("button", { class: "btn-ok", text: "保存", onclick: save }),
      el("button", { class: "btn-ok secondary", text: "取消", onclick: () => mask.remove() }),
    ]),
  ]);
  const mask = el("div", { class: "modal-mask" });
  mask.append(modal);
  document.body.append(mask);
  titleInput.focus();

  async function save() {
    try {
      await api.editMetadata(path, titleInput.value, artistInput.value, albumInput.value);
      const [updated] = await api.readTracks([path]);
      if (updated) {
        state.trackMap.set(path, updated);
        const idx = state.tracks.findIndex((x) => x.path === path);
        if (idx >= 0) state.tracks[idx] = updated;
        notify();
      }
      toast("已保存");
    } catch {
      toast("保存失败");
    }
    mask.remove();
  }
}
