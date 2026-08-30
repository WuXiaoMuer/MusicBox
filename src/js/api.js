const { invoke, convertFileSrc } = window.__TAURI__.core;
const { listen, emit } = window.__TAURI__.event;

export { invoke, convertFileSrc, listen, emit };

export const api = {
  scanFolders: (folders) => invoke("scan_folders", { folders }),
  readTracks: (paths) => invoke("read_tracks", { paths }),
  getCover: (path) => invoke("get_cover", { path }),
  getLyrics: (path) => invoke("get_lyrics", { path }),
  downloadLyrics: (path) => invoke("download_lyrics", { path }),
  pickFolder: () => invoke("pick_folder"),
  pickFiles: () => invoke("pick_files"),
  loadState: () => invoke("load_state"),
  saveState: (state) => invoke("save_state", { state }),
  allowPaths: (paths) => invoke("allow_paths", { paths }),
  mediaUpdateMetadata: (meta) => invoke("media_update_metadata", meta),
  mediaUpdatePlayback: (playing, position) =>
    invoke("media_update_playback", { playing, position }),
  setCloseToTray: (value) => invoke("set_close_to_tray", { value }),
  setAlwaysOnTop: (value) => invoke("set_always_on_top", { value }),
  toggleMini: () => invoke("toggle_mini"),
  showMain: () => invoke("show_main"),
  revealInDir: (path) => invoke("reveal_in_dir", { path }),
  setFullscreen: (value) => invoke("set_fullscreen", { value }),
  exportM3u: (content) => invoke("export_m3u", { content }),
  editMetadata: (path, title, artist, album) => invoke("edit_metadata", { path, title, artist, album }),
  openUrl: (url) => invoke("open_url", { url }),
  downloadUrl: (url) => invoke("download_url", { url }),
  exportSettings: (content) => invoke("export_settings", { content }),
  importSettings: () => invoke("import_settings"),
  pickImage: () => invoke("pick_image"),
};
