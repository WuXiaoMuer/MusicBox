export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

export function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

let toastTimer = null;
export function toast(msg) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const t = el("div", { class: "toast", text: msg });
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
}

let menuEl = null;
export function showContextMenu(items, x, y) {
  closeContextMenu();
  menuEl = el("div", { class: "context-menu" });
  for (const item of items) {
    if (item === "sep") {
      menuEl.append(el("div", { class: "menu-sep" }));
      continue;
    }
    const btn = el("button", { class: item.danger ? "danger" : "", text: item.label });
    btn.addEventListener("click", () => {
      closeContextMenu();
      item.action && item.action();
    });
    menuEl.append(btn);
  }
  document.body.append(menuEl);
  const rect = menuEl.getBoundingClientRect();
  let left = x;
  let top = y;
  if (left + rect.width > window.innerWidth) left -= rect.width;
  if (top + rect.height > window.innerHeight) top -= rect.height;
  menuEl.style.left = left + "px";
  menuEl.style.top = top + "px";
}

export function closeContextMenu() {
  if (menuEl) {
    menuEl.remove();
    menuEl = null;
  }
}

export function promptModal(title, initial = "", placeholder = "") {
  return new Promise((resolve) => {
    const input = el("input", { type: "text", value: initial, placeholder });
    const done = (val) => {
      mask.remove();
      resolve(val);
    };
    const mask = el("div", { class: "modal-mask" });
    const modal = el("div", { class: "modal" }, [
      el("h3", { text: title }),
      input,
      el("div", { class: "modal-actions" }, [
        el("button", { class: "btn-cancel", text: "取消", onclick: () => done(null) }),
        el("button", { class: "btn-ok", text: "确定", onclick: () => done(input.value.trim() || null) }),
      ]),
    ]);
    mask.append(modal);
    mask.addEventListener("mousedown", (e) => {
      if (e.target === mask) done(null);
    });
    document.body.append(mask);
    input.focus();
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") done(input.value.trim() || null);
      else if (e.key === "Escape") done(null);
    });
  });
}

document.addEventListener("mousedown", (e) => {
  if (menuEl && !menuEl.contains(e.target)) closeContextMenu();
});
