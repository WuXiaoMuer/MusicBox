import { api } from "./api.js";
import { escapeHtml, fmtTime } from "./ui.js";

let overlay = null;
let bodyEl = null;
let open = false;
let lyrics = null; // { lines: [{time, text}], offset }
let activeIndex = -1;
let meta = { title: "", artist: "" };
let coverUrl = "";
let duration = 0;
let playing = false;
let userOffset = 0; // 用户微调偏移（秒）

export function isOpen() {
  return open;
}

export function toggle() {
  if (open) close();
  else openPanel();
}

export function setMeta(title, artist) {
  meta = { title, artist };
  if (open) {
    overlay.querySelector(".np-title").textContent = title || "未知曲目";
    overlay.querySelector(".np-artist").textContent = artist || "";
  }
}

export function setCover(url) {
  coverUrl = url;
  if (open) overlay.querySelector(".np-cover").src = url;
}

export function setDuration(d) {
  duration = d || 0;
  if (open) overlay.querySelector(".np-dur").textContent = fmtTime(duration);
}

export function setPlaying(p) {
  playing = p;
  if (open) {
    overlay.querySelector(".np-cover-wrap").classList.toggle("playing", p);
    const ic = overlay.querySelector("#np-play-icon");
    ic.innerHTML = p
      ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
  }
}

export function setUrlTrack(isUrl) {
  if (open) {
    const btn = overlay.querySelector(".np-download");
    if (btn) btn.style.display = isUrl ? "" : "none";
  }
}

/// 微调歌词时间轴，返回当前偏移（秒）。
export function adjustOffset(delta) {
  userOffset = Math.round((userOffset + delta) * 10) / 10;
  return userOffset;
}

export async function loadFor(path) {
  currentPath = path;
  lyrics = null;
  activeIndex = -1;
  try {
    const text = await api.getLyrics(path);
    lyrics = text ? parseLrc(text) : null;
  } catch {
    lyrics = null;
  }
  // 本地/内嵌无歌词时，尝试在线下载（每首歌只试一次）
  if (!lyrics && !attempted.has(path)) {
    attempted.add(path);
    await tryDownload(path);
  }
  if (open) renderLines();
}

async function tryDownload(path) {
  try {
    const text = await api.downloadLyrics(path);
    if (text) lyrics = parseLrc(text);
  } catch {
    /* 忽略下载失败 */
  }
}

const attempted = new Set();
let currentPath = "";

export function tick(t) {
  if (!open) return;
  if (duration) {
    const seek = overlay.querySelector(".np-seek");
    seek.value = (t / duration) * 1000;
    seek.style.setProperty("--fill", (t / duration) * 100 + "%");
    overlay.querySelector(".np-cur").textContent = fmtTime(t);
  }
  if (!lyrics || !lyrics.lines.length) return;
  const time = t - (lyrics.offset || 0) - userOffset;
  let idx = -1;
  for (let i = 0; i < lyrics.lines.length; i++) {
    if (lyrics.lines[i].time <= time) idx = i;
    else break;
  }
  if (idx !== activeIndex) {
    activeIndex = idx;
    highlight();
  }
}

function parseLrc(text) {
  const lines = [];
  let offset = 0;
  for (const raw of text.split(/\r?\n/)) {
    const om = raw.match(/\[offset:([+-]?\d+)\]/i);
    if (om) {
      offset = parseInt(om[1], 10) / 1000;
      continue;
    }
    const tags = [...raw.matchAll(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
    if (!tags.length) continue;
    const content = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const tag of tags) {
      const m = parseInt(tag[1], 10);
      const s = parseInt(tag[2], 10);
      const frac = tag[3] ? parseInt(tag[3].padEnd(3, "0"), 10) : 0;
      lines.push({ time: m * 60 + s + frac / 1000, text: content });
    }
  }
  lines.sort((a, b) => a.time - b.time);
  return { lines, offset };
}

function openPanel() {
  open = true;
  overlay = document.createElement("div");
  overlay.className = "lyrics-overlay";
  overlay.innerHTML = `
    <button class="np-close icon-btn" title="关闭">✕</button>
    <button class="np-fullscreen icon-btn" title="全屏">
      <svg viewBox="0 0 24 24" class="ic"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
    </button>
    <div class="np-view">
      <div class="np-cover-wrap${playing ? " playing" : ""}">
        <img class="np-cover" alt="" />
      </div>
      <div class="np-meta">
        <div class="np-title">${escapeHtml(meta.title || "未知曲目")}</div>
        <div class="np-artist">${escapeHtml(meta.artist || "")}</div>
      </div>
      <div class="lyrics-body"></div>
      <div class="np-controls">
        <div class="progress-row np-progress">
          <span class="time np-cur">0:00</span>
          <input class="np-seek" type="range" min="0" max="1000" step="1" value="0" />
          <span class="time np-dur">0:00</span>
        </div>
        <div class="np-buttons">
          <button class="icon-btn" data-np="mode" title="播放模式">
            <svg viewBox="0 0 24 24" class="ic"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
          </button>
          <button class="icon-btn" data-np="prev" title="上一首">
            <svg viewBox="0 0 24 24" class="ic"><path d="M6 6h2v12H6zM20 6l-10 6 10 6z"/></svg>
          </button>
          <button class="icon-btn play" data-np="play" title="播放/暂停">
            <svg viewBox="0 0 24 24" class="ic" id="np-play-icon"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="icon-btn" data-np="next" title="下一首">
            <svg viewBox="0 0 24 24" class="ic"><path d="M16 6h2v12h-2zM4 6l10 6-10 6z"/></svg>
          </button>
          <button class="icon-btn np-download" data-np="download" title="下载到本地" style="display:none">
            <svg viewBox="0 0 24 24" class="ic"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 19h16" /></svg>
          </button>
        </div>
      </div>
    </div>`;

  bodyEl = overlay.querySelector(".lyrics-body");
  overlay.querySelector(".np-cover").src = coverUrl;

  overlay.querySelector(".np-close").addEventListener("click", close);
  overlay.querySelector(".np-fullscreen").addEventListener("click", () => {
    fullscreenOn = !fullscreenOn;
    api.setFullscreen(fullscreenOn).catch(() => {});
  });
  overlay.querySelector(".np-seek").addEventListener("input", (e) => {
    e.target.style.setProperty("--fill", e.target.value / 10 + "%");
    window.dispatchEvent(new CustomEvent("np:seek", { detail: e.target.value / 1000 }));
  });
  overlay.querySelectorAll("[data-np]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("np:" + btn.dataset.np));
    });
  });

  document.body.append(overlay);
  setDuration(duration);
  renderLines();
}

function close() {
  open = false;
  if (fullscreenOn) {
    fullscreenOn = false;
    api.setFullscreen(false).catch(() => {});
  }
  if (overlay) {
    overlay.remove();
    overlay = null;
    bodyEl = null;
  }
}

let fullscreenOn = false;

function renderLines() {
  if (!bodyEl) return;
  activeIndex = -1;
  if (!lyrics || !lyrics.lines.length) {
    bodyEl.innerHTML = `
      <div class="lyrics-empty">
        <p>暂无歌词</p>
        <button class="lyrics-search-btn">搜索歌词</button>
      </div>`;
    bodyEl.querySelector(".lyrics-search-btn").addEventListener("click", async () => {
      if (!currentPath) return;
      bodyEl.querySelector(".lyrics-empty").innerHTML = "<p>正在搜索歌词…</p>";
      attempted.add(currentPath);
      await tryDownload(currentPath);
      renderLines();
    });
    return;
  }
  bodyEl.innerHTML = lyrics.lines
    .map((l, i) => `<p class="lyric-line" data-i="${i}">${escapeHtml(l.text) || "…"}</p>`)
    .join("");
}

function highlight() {
  if (!bodyEl) return;
  const prev = bodyEl.querySelector(".lyric-line.active");
  if (prev) prev.classList.remove("active");
  if (activeIndex < 0) return;
  const cur = bodyEl.querySelector(`.lyric-line[data-i="${activeIndex}"]`);
  if (cur) {
    cur.classList.add("active");
    cur.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}
