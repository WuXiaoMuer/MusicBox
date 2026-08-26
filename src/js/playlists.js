import { state, notify, persist, uid } from "./state.js";
import { el, toast, promptModal } from "./ui.js";
import { api } from "./api.js";

export function getPlaylist(id) {
  return state.playlists.find((p) => p.id === id);
}

export function renderPlaylistSidebar() {
  const list = document.getElementById("playlist-list");
  list.innerHTML = "";
  for (const pl of state.playlists) {
    const active = state.view === pl.id;
    const nameEl = el("span", { class: "pl-name", text: pl.name });
    const item = el("li", { class: "playlist-item" + (active ? " active" : "") }, [nameEl]);

    const actions = el("div", { class: "pl-actions" }, [
      el("button", {
        title: "导出 .m3u",
        text: "⭳",
        onclick: (e) => {
          e.stopPropagation();
          exportPlaylist(pl.id);
        },
      }),
      el("button", {
        title: "重命名",
        text: "✎",
        onclick: (e) => {
          e.stopPropagation();
          renamePlaylist(pl.id);
        },
      }),
      el("button", {
        title: "删除",
        text: "✕",
        onclick: (e) => {
          e.stopPropagation();
          deletePlaylist(pl.id);
        },
      }),
    ]);
    item.append(actions);

    item.addEventListener("click", () => {
      state.view = pl.id;
      document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
      notify();
    });
    list.append(item);
  }
}

export async function createPlaylist() {
  const name = await promptModal("新建歌单", "", "歌单名称");
  if (!name) return;
  state.playlists.push({ id: uid(), name, tracks: [] });
  persist();
  renderPlaylistSidebar();
  notify();
  toast(`已创建歌单「${name}」`);
}

async function renamePlaylist(id) {
  const pl = getPlaylist(id);
  if (!pl) return;
  const name = await promptModal("重命名歌单", pl.name);
  if (!name) return;
  pl.name = name;
  persist();
  renderPlaylistSidebar();
  notify();
}

function deletePlaylist(id) {
  const pl = getPlaylist(id);
  if (!pl) return;
  state.playlists = state.playlists.filter((p) => p.id !== id);
  if (state.view === id) state.view = "library";
  persist();
  renderPlaylistSidebar();
  notify();
  toast(`已删除歌单「${pl.name}」`);
}

export function addToPlaylist(id, paths) {
  const pl = getPlaylist(id);
  if (!pl) return false;
  const existing = new Set(pl.tracks);
  let added = 0;
  for (const p of paths) {
    if (!existing.has(p)) {
      pl.tracks.push(p);
      existing.add(p);
      added++;
    }
  }
  if (added) {
    persist();
    notify();
  }
  return added;
}

export function removeFromPlaylist(id, path) {
  const pl = getPlaylist(id);
  if (!pl) return;
  pl.tracks = pl.tracks.filter((p) => p !== path);
  persist();
  notify();
}

export async function exportPlaylist(id) {
  const pl = getPlaylist(id);
  if (!pl || !pl.tracks.length) {
    toast("歌单为空");
    return;
  }
  const lines = ["#EXTM3U"];
  for (const p of pl.tracks) {
    const t = state.trackMap.get(p);
    if (!t) continue;
    const dur = Math.round(t.duration || 0);
    lines.push(`#EXTINF:${dur},${t.artist || ""} - ${t.title}`);
    lines.push(t.path);
  }
  try {
    const saved = await api.exportM3u(lines.join("\n"));
    if (saved) toast("已导出歌单");
  } catch {
    toast("导出失败");
  }
}
