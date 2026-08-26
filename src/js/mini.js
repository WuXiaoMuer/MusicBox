const { emit, listen } = window.__TAURI__.event;
const { invoke } = window.__TAURI__.core;

const title = document.getElementById("m-title");
const artist = document.getElementById("m-artist");
const cover = document.getElementById("m-cover");
const playIcon = document.getElementById("m-play-icon");

const PLAY = '<path d="M8 5v14l11-7z"/>';
const PAUSE = '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>';

function setPlaying(p) {
  playIcon.innerHTML = p ? PAUSE : PLAY;
}

listen("mini-state", (e) => {
  const s = e.payload || {};
  title.textContent = s.title || "未在播放";
  artist.textContent = s.artist || "";
  if (s.cover) cover.src = s.cover;
  setPlaying(!!s.playing);
});

document.getElementById("m-play").addEventListener("click", () => emit("mini-cmd", "toggle"));
document.getElementById("m-prev").addEventListener("click", () => emit("mini-cmd", "prev"));
document.getElementById("m-next").addEventListener("click", () => emit("mini-cmd", "next"));
document.getElementById("m-close").addEventListener("click", () => invoke("toggle_mini"));
cover.addEventListener("click", () => invoke("show_main"));
