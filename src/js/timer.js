import { toast } from "./ui.js";
import * as player from "./audio.js";

let timer = null;

export function isActive() {
  return !!timer;
}

export function setSleep(minutes) {
  cancelSleep();
  if (!minutes || minutes <= 0) return;
  timer = setTimeout(() => {
    timer = null;
    if (player.isPlaying()) player.toggle();
    toast("睡眠定时结束，已暂停播放");
    refresh();
  }, minutes * 60000);
  toast(`将在 ${minutes} 分钟后停止播放`);
  refresh();
}

export function cancelSleep() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    refresh();
  }
}

function refresh() {
  const btn = document.getElementById("sleep-btn");
  if (btn) btn.classList.toggle("active", !!timer);
}
