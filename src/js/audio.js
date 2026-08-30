import { api, convertFileSrc, emit } from "./api.js";
import { state, currentTrack, notify, persist, pushHistory } from "./state.js";
import { fmtTime, toast } from "./ui.js";
import * as lyrics from "./lyrics.js";

const audio = document.getElementById("audio");

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#2a2a2e"/><stop offset="1" stop-color="#151517"/></linearGradient></defs>' +
      '<rect width="512" height="512" fill="url(#g)"/>' +
      '<text x="256" y="330" font-size="220" text-anchor="middle" fill="#4a4a50" font-family="Segoe UI, sans-serif">♪</text>' +
      "</svg>"
  );

const MODE_META = {
  sequence: {
    title: "顺序播放",
    path: '<path d="M4 7h13M14 4l3 3-3 3"/><path d="M20 17H7M10 14l-3 3 3 3"/>',
  },
  repeatAll: {
    title: "列表循环",
    path: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  },
  repeatOne: {
    title: "单曲循环",
    path: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h2v4h-2z"/>',
  },
  shuffle: {
    title: "随机播放",
    path: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/>',
  },
};

export function init() {
  audio.volume = state.settings.volume || 0.8;
  audio.muted = !!state.settings.muted;
  const vol = document.getElementById("volume");
  vol.value = (audio.volume * 100).toFixed(0);

  audio.addEventListener("timeupdate", () => {
    if (audio.duration) {
      const pct = (audio.currentTime / audio.duration) * 100;
      const seek = document.getElementById("seek");
      seek.value = pct * 10;
      seek.style.setProperty("--fill", pct + "%");
      document.getElementById("cur-time").textContent = fmtTime(audio.currentTime);
    }
    lyrics.tick(audio.currentTime);
  });

  audio.addEventListener("loadedmetadata", () => {
    document.getElementById("dur-time").textContent = fmtTime(audio.duration);
    lyrics.setDuration(audio.duration);
  });

  audio.addEventListener("seeked", () => {
    api.mediaUpdatePlayback(!audio.paused, audio.currentTime).catch(() => {});
  });

  audio.addEventListener("ended", () => {
    if (state.settings.playMode === "repeatOne") {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else {
      next();
    }
  });

  audio.addEventListener("play", () => {
    setPlayIcon(true);
    lyrics.setPlaying(true);
    emitMiniState(true);
    api.mediaUpdatePlayback(true, audio.currentTime).catch(() => {});
  });
  audio.addEventListener("pause", () => {
    setPlayIcon(false);
    lyrics.setPlaying(false);
    emitMiniState(false);
    api.mediaUpdatePlayback(false, audio.currentTime).catch(() => {});
  });

  renderMode();
  updateVolumeIcon();
  setPlayIcon(false);
}

export function hasTrack() {
  return !!currentTrack();
}

export function isPlaying() {
  return !audio.paused && !audio.ended;
}

export function playQueue(paths, index) {
  state.currentQueue = paths;
  state.queueIndex = index;
  loadAndPlay();
}

export function playSingle(path) {
  const idx = state.currentQueue.indexOf(path);
  if (idx >= 0) {
    state.queueIndex = idx;
  } else {
    state.currentQueue = [path];
    state.queueIndex = 0;
  }
  loadAndPlay();
}

export function prepare(path, position) {
  const track = state.trackMap.get(path);
  if (!track) return;
  state.currentQueue = [path];
  state.queueIndex = 0;
  loadTrackInternal(track, position);
}

/// 仅加载曲目到播放器（不改动队列），用于恢复会话。
export function loadTrack(path, position) {
  const track = state.trackMap.get(path);
  if (!track) return;
  loadTrackInternal(track, position);
}

function loadTrackInternal(track, position) {
  audio.src = convertFileSrc(track.path);
  renderNowPlaying(track);
  updateMediaMeta(track);
  if (position != null) {
    const onMeta = () => {
      audio.currentTime = position || 0;
      audio.removeEventListener("loadedmetadata", onMeta);
    };
    audio.addEventListener("loadedmetadata", onMeta);
  }
}

function loadAndPlay() {
  const track = currentTrack();
  if (!track) return;
  audio.src = track.url || convertFileSrc(track.path);
  renderNowPlaying(track);
  updateMediaMeta(track);
  audio.play().catch(() => {});
  emitMiniState(true);
  state.settings.lastTrack = track.path;
  pushHistory(track.path);
  state.playCounts[track.path] = (state.playCounts[track.path] || 0) + 1;
  persist();
  notify();
}

/// 播放在线链接（网络音频 URL）。
export function playUrl(url) {
  const s = url.trim();
  if (!/^https?:\/\//i.test(s)) {
    toast("请输入有效的 http/https 链接");
    return;
  }
  const path = "url:" + s;
  const title = decodeURIComponent(s.split("/").pop()?.split("?")[0] || "在线音乐") || "在线音乐";
  const track = { path, url: s, title, artist: "在线音乐", album: "", duration: 0, hasCover: false, isUrl: true };
  state.trackMap.set(path, track);
  state.currentQueue.push(path);
  state.queueIndex = state.currentQueue.length - 1;
  loadAndPlay();
  notify();
}

export function isUrlTrack(track) {
  return !!track && !!track.url;
}

function updateMediaMeta(track) {
  lyrics.setMeta(track.title, track.artist || "未知歌手");
  lyrics.loadFor(track.path);
  api
    .mediaUpdateMetadata({
      title: track.title,
      artist: track.artist || "未知歌手",
      album: track.album || "",
      duration: track.duration,
    })
    .catch(() => {});
}

async function renderNowPlaying(track) {
  document.getElementById("np-title").textContent = track.title;
  document.getElementById("np-artist").textContent = track.artist || "未知歌手";
  updateFavIcon();
  // 在线歌曲显示下载按钮
  lyrics.setUrlTrack(isUrlTrack(track));
  const cover = document.getElementById("np-cover");
  const backdrop = document.getElementById("backdrop-img");
  cover.src = PLACEHOLDER;
  lyrics.setCover(PLACEHOLDER);
  currentCoverUrl = PLACEHOLDER;
  if (state.settings.bgImage) {
    // 自定义背景优先
    backdrop.src = convertFileSrc(state.settings.bgImage);
  } else {
    backdrop.src = PLACEHOLDER;
    if (track.hasCover) {
      try {
        const url = await api.getCover(track.path);
        if (url) {
          cover.src = url;
          backdrop.src = url;
          lyrics.setCover(url);
          currentCoverUrl = url;
          emitMiniState(!audio.paused);
        }
      } catch {
        /* 忽略封面读取失败 */
      }
    }
  }
}

let currentCoverUrl = PLACEHOLDER;

function emitMiniState(playing) {
  const t = currentTrack();
  emit("mini-state", {
    title: t ? t.title : "",
    artist: t ? t.artist || "未知歌手" : "",
    cover: currentCoverUrl,
    playing,
  });
}

export function syncMini() {
  emitMiniState(!audio.paused);
}

export function toggle() {
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

/// 停止播放并清空当前曲目。
export function stop() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  state.queueIndex = -1;
  notify();
}

export function next() {
  if (state.nextQueue.length) {
    const p = state.nextQueue.shift();
    const idx = state.currentQueue.indexOf(p);
    if (idx >= 0) {
      state.queueIndex = idx;
      loadAndPlay();
      return;
    }
    state.currentQueue.splice(state.queueIndex + 1, 0, p);
    state.queueIndex += 1;
    loadAndPlay();
    return;
  }

  const len = state.currentQueue.length;
  if (!len) return;
  const mode = state.settings.playMode;

  if (mode === "shuffle") {
    let i = state.queueIndex;
    while (len > 1 && i === state.queueIndex) i = Math.floor(Math.random() * len);
    state.queueIndex = i;
    loadAndPlay();
    return;
  }

  let i = state.queueIndex + 1;
  if (i >= len) {
    if (mode === "repeatAll") {
      i = 0;
    } else {
      state.queueIndex = -1;
      audio.pause();
      audio.removeAttribute("src");
      setPlayIcon(false);
      notify();
      return;
    }
  }
  state.queueIndex = i;
  loadAndPlay();
}

export function prev() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  const len = state.currentQueue.length;
  if (!len) return;
  const mode = state.settings.playMode;
  if (mode === "shuffle") {
    state.queueIndex = Math.floor(Math.random() * len);
  } else {
    let i = state.queueIndex - 1;
    if (i < 0) i = mode === "repeatAll" ? len - 1 : 0;
    state.queueIndex = i;
  }
  loadAndPlay();
}

export function cycleMode() {
  const modes = Object.keys(MODE_META);
  const i = modes.indexOf(state.settings.playMode);
  setMode(modes[(i + 1) % modes.length]);
  toast("播放模式：" + MODE_META[state.settings.playMode].title);
}

export function setMode(mode) {
  if (!MODE_META[mode]) return;
  state.settings.playMode = mode;
  renderMode();
  persist();
}

function renderMode() {
  const meta = MODE_META[state.settings.playMode] || MODE_META.sequence;
  document.getElementById("mode-icon").innerHTML = meta.path;
  document.getElementById("mode-btn").title = meta.title;
}

export function toggleMute() {
  audio.muted = !audio.muted;
  state.settings.muted = audio.muted;
  updateVolumeIcon();
  persist();
}

export function setVolume(v) {
  audio.volume = v;
  audio.muted = false;
  state.settings.volume = v;
  state.settings.muted = false;
  updateVolumeIcon();
  debouncedPersist();
}

let persistTimer = null;
function debouncedPersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persist(), 400);
}

export function seekTo(fraction) {
  if (audio.duration) {
    audio.currentTime = fraction * audio.duration;
  }
}

export function seekToTime(sec) {
  if (isFinite(sec) && sec >= 0) {
    audio.currentTime = sec;
  }
}

export function seekBy(delta) {
  if (!audio.duration) return;
  const t = Math.min(audio.duration, Math.max(0, audio.currentTime + delta));
  audio.currentTime = t;
}

export function volumeBy(delta) {
  const v = Math.min(1, Math.max(0, audio.volume + delta));
  setVolume(v);
  document.getElementById("volume").value = (v * 100).toFixed(0);
}

export function toggleFavorite() {
  const track = currentTrack();
  if (!track) return;
  const i = state.favorites.indexOf(track.path);
  if (i >= 0) {
    state.favorites.splice(i, 1);
    toast("已取消收藏");
  } else {
    state.favorites.push(track.path);
    toast("已收藏");
  }
  updateFavIcon();
  persist();
  notify();
}

function updateFavIcon() {
  const track = currentTrack();
  const btn = document.getElementById("fav-btn");
  btn.classList.toggle("active", !!(track && state.favorites.includes(track.path)));
}

function updateVolumeIcon() {
  const ic = document.getElementById("volume-icon");
  const v = audio.muted ? 0 : audio.volume;
  if (v === 0) {
    ic.innerHTML = '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m16 9 6 6M22 9l-6 6"/>';
  } else if (v < 0.5) {
    ic.innerHTML = '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>';
  } else {
    ic.innerHTML = '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9.5 9.5 0 0 1 0 13"/>';
  }
}

function setPlayIcon(playing) {
  const ic = document.getElementById("play-icon");
  ic.innerHTML = playing
    ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>'
    : '<path d="M8 5v14l11-7z"/>';
}
