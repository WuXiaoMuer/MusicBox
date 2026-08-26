import { state, currentTrack, persist } from "./state.js";
import { escapeHtml, el } from "./ui.js";
import * as player from "./audio.js";

let mask = null;
let drawer = null;
let body = null;
let open = false;

export function isOpen() {
  return open;
}

export function toggle() {
  if (open) close();
  else openPanel();
}

export function refresh() {
  if (open) render();
}

function openPanel() {
  open = true;
  mask = el("div", { class: "queue-mask" });
  drawer = el("aside", { class: "queue-drawer" });
  const clearBtn = el("button", { class: "queue-clear", text: "清空队列", onclick: clear });
  drawer.append(
    el("div", { class: "queue-header" }, [
      el("span", { class: "queue-title", text: "播放队列" }),
      clearBtn,
    ])
  );
  body = el("div", { class: "queue-body" });
  drawer.append(body);
  mask.addEventListener("click", close);
  document.body.append(mask, drawer);
  render();
}

function close() {
  open = false;
  if (mask) mask.remove();
  if (drawer) drawer.remove();
  mask = null;
  drawer = null;
  body = null;
}

function render() {
  if (!body) return;
  body.innerHTML = "";

  const cur = currentTrack();
  const upcoming = state.currentQueue.slice(Math.max(0, state.queueIndex + 1));

  // 正在播放
  if (cur) {
    body.append(
      section("正在播放", [
        row(cur.path, true, false),
      ])
    );
  }

  // 下一首播放
  if (state.nextQueue.length) {
    const items = state.nextQueue.map((p) => row(p, false, true));
    body.append(section("下一首播放", items));
  }

  // 接下来
  if (upcoming.length) {
    const items = upcoming.map((p) => row(p, false, false));
    body.append(section("接下来播放", items));
  }

  if (!cur && !state.nextQueue.length && !upcoming.length) {
    body.append(el("div", { class: "queue-empty", text: "队列为空" }));
  }
}

function section(title, rows) {
  const wrap = el("div", { class: "queue-section" });
  wrap.append(el("div", { class: "queue-section-title", text: title }));
  for (const r of rows) wrap.append(r);
  return wrap;
}

function row(path, isCurrent, isNext) {
  const track = state.trackMap.get(path);
  if (!track) return el("div");

  const idx = el("span", { class: "q-idx", text: isCurrent ? "♪" : "" });
  const info = el("div", { class: "q-info" }, [
    el("div", { class: "q-title", text: track.title }),
    el("div", { class: "q-artist", text: track.artist || "未知歌手" }),
  ]);
  const rm = el("button", {
    class: "q-remove",
    text: "✕",
    title: "移除",
    onclick: (e) => {
      e.stopPropagation();
      removeFromQueue(path);
    },
  });

  const item = el("div", { class: "q-item" + (isCurrent ? " current" : "") }, [idx, info, rm]);
  item.addEventListener("click", () => jumpTo(path, isNext));
  return item;
}

function jumpTo(path, isNext) {
  if (isNext) {
    state.nextQueue = state.nextQueue.filter((p) => p !== path);
  }
  player.playSingle(path);
  render();
}

function removeFromQueue(path) {
  state.nextQueue = state.nextQueue.filter((p) => p !== path);
  const i = state.currentQueue.indexOf(path);
  if (i >= 0) {
    state.currentQueue.splice(i, 1);
    if (i < state.queueIndex) state.queueIndex -= 1;
    else if (i === state.queueIndex) state.queueIndex = -1;
  }
  persist();
  render();
}

function clear() {
  state.nextQueue = [];
  if (state.queueIndex >= 0) {
    state.currentQueue = state.currentQueue.slice(0, state.queueIndex + 1);
  } else {
    state.currentQueue = [];
  }
  persist();
  render();
}
