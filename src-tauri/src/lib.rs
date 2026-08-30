mod library;
mod media;
mod models;
mod store;
mod tray;

use std::sync::atomic::{AtomicBool, Ordering};

use models::{AppState, Track};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// 关闭按钮行为：true = 最小化到托盘，false = 直接退出。
struct CloseBehavior(AtomicBool);

/// 选择音乐文件夹（原生对话框）。
#[tauri::command(async)]
fn pick_folder(app: AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().to_string())
}

/// 选择音频文件（可多选）。
#[tauri::command(async)]
fn pick_files(app: AppHandle) -> Option<Vec<String>> {
    app.dialog()
        .file()
        .add_filter("音频文件", &["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus"])
        .blocking_pick_files()
        .map(|files| {
            files
                .into_iter()
                .filter_map(|f| f.into_path().ok())
                .map(|p| p.to_string_lossy().to_string())
                .collect()
        })
}

/// 扫描文件夹并返回曲目列表，同时把这些目录加入 asset 协议白名单。
#[tauri::command(async)]
fn scan_folders(app: AppHandle, folders: Vec<String>) -> Vec<Track> {
    for f in &folders {
        let _ = app.asset_protocol_scope().allow_directory(f, true);
    }
    library::scan_folders(&folders)
}

/// 懒加载内嵌封面，返回 base64 data URL。
#[tauri::command(async)]
fn get_cover(path: String) -> Option<String> {
    library::get_cover(&path)
}

/// 读取歌词：优先同目录 .lrc，其次内嵌标签。
#[tauri::command(async)]
fn get_lyrics(path: String) -> Option<String> {
    library::get_lyrics(&path)
}

/// 在线下载歌词（lrclib），成功则保存 .lrc 并返回。
#[tauri::command(async)]
fn download_lyrics(path: String) -> Option<String> {
    library::download_lyrics(&path)
}

/// 编辑并写回歌曲元数据（标题/歌手/专辑）。
#[tauri::command(async)]
fn edit_metadata(path: String, title: String, artist: String, album: String) -> Result<(), String> {
    library::edit_metadata(&path, &title, &artist, &album)
}

/// 读取指定文件列表的元数据（用于拖放/添加文件）。
#[tauri::command(async)]
fn read_tracks(paths: Vec<String>) -> Vec<Track> {
    library::read_tracks(&paths)
}

/// 把路径加入 asset 协议白名单（文件或目录）。
#[tauri::command]
fn allow_paths(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    for p in &paths {
        let path = std::path::Path::new(p);
        if path.is_dir() {
            app.asset_protocol_scope()
                .allow_directory(path, true)
                .map_err(|e| e.to_string())?;
        } else {
            app.asset_protocol_scope()
                .allow_file(path)
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn load_state(app: AppHandle) -> AppState {
    store::load_state(&app)
}

#[tauri::command]
fn save_state(app: AppHandle, state: AppState) -> Result<(), String> {
    store::save_state(&app, &state)
}

#[tauri::command]
fn set_close_to_tray(app: AppHandle, value: bool) {
    app.state::<CloseBehavior>().0.store(value, Ordering::Relaxed);
}

#[tauri::command]
fn set_always_on_top(app: AppHandle, value: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_always_on_top(value).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn toggle_mini(app: AppHandle) -> Result<(), String> {
    if let Some(mini) = app.get_webview_window("mini") {
        if mini.is_visible().unwrap_or(false) {
            let _ = mini.hide();
        } else {
            let _ = mini.show();
            let _ = mini.set_focus();
            // 通知主窗口刷新迷你窗状态
            let _ = app.emit("mini-opened", ());
        }
    }
    Ok(())
}

#[tauri::command]
fn show_main(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn reveal_in_dir(app: AppHandle, path: String) -> Result<(), String> {
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_fullscreen(app: AppHandle, value: bool) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        w.set_fullscreen(value).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command(async)]
fn export_m3u(app: AppHandle, content: String) -> Option<String> {
    let path = app
        .dialog()
        .file()
        .set_file_name("playlist.m3u")
        .add_filter("M3U 播放列表", &["m3u"])
        .blocking_save_file()?
        .into_path()
        .ok()?;
    std::fs::write(&path, content).ok()?;
    Some(path.to_string_lossy().to_string())
}

#[tauri::command]
fn open_url(app: AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<String>)
        .map_err(|e| e.to_string())
}

#[tauri::command(async)]
fn download_url(app: AppHandle, url: String) -> Option<String> {
    use std::io::Read;

    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(120))
        .build();
    let resp = agent.get(&url).call().ok()?;
    let mut data = Vec::new();
    resp.into_reader()
        .take(500 * 1024 * 1024)
        .read_to_end(&mut data)
        .ok()?;
    let default_name = url
        .split('/')
        .last()
        .filter(|s| !s.is_empty() && s.contains('.'))
        .unwrap_or("download");
    let path = app
        .dialog()
        .file()
        .set_file_name(default_name)
        .blocking_save_file()?
        .into_path()
        .ok()?;
    std::fs::write(&path, data).ok()?;
    Some(path.to_string_lossy().to_string())
}

#[tauri::command(async)]
fn export_settings(app: AppHandle, content: String) -> Option<String> {
    let path = app
        .dialog()
        .file()
        .set_file_name("musicbox-settings.json")
        .add_filter("JSON", &["json"])
        .blocking_save_file()?
        .into_path()
        .ok()?;
    std::fs::write(&path, content).ok()?;
    Some(path.to_string_lossy().to_string())
}

#[tauri::command(async)]
fn import_settings(app: AppHandle) -> Option<String> {
    let path = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .blocking_pick_file()?
        .into_path()
        .ok()?;
    std::fs::read_to_string(&path).ok()
}

#[tauri::command(async)]
fn pick_image(app: AppHandle) -> Option<String> {
    let path = app
        .dialog()
        .file()
        .add_filter("图片", &["png", "jpg", "jpeg", "webp", "bmp", "gif"])
        .blocking_pick_file()?
        .into_path()
        .ok()?;
    let _ = app.asset_protocol_scope().allow_file(&path);
    Some(path.to_string_lossy().to_string())
}

pub fn run() {
    tauri::Builder::default()
        .manage(CloseBehavior(AtomicBool::new(true)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 启动时恢复持久化的路径白名单
            let state = store::load_state(app.handle());
            for f in &state.folders {
                let _ = app.asset_protocol_scope().allow_directory(f, true);
            }
            for f in &state.favorites {
                let _ = app.asset_protocol_scope().allow_file(f);
            }
            for pl in &state.playlists {
                for t in &pl.tracks {
                    let _ = app.asset_protocol_scope().allow_file(t);
                }
            }

            // 系统托盘与系统媒体控制（非致命，失败仅记录）
            if let Err(e) = tray::init(app) {
                eprintln!("托盘初始化失败: {e}");
            }
            if let Err(e) = media::init(app) {
                eprintln!("系统媒体控制初始化失败: {e}");
            }

            // 恢复窗口大小与位置
            store::load_window_state(app.handle());

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                store::save_window_state(&app);
                if app.state::<CloseBehavior>().0.load(Ordering::Relaxed) {
                    api.prevent_close();
                    let _ = window.hide();
                }
                return;
            }
            if let WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                let paths: Vec<String> =
                    paths.iter().map(|p| p.to_string_lossy().to_string()).collect();
                let app = window.app_handle();
                for p in &paths {
                    let path = std::path::Path::new(p);
                    if path.is_dir() {
                        let _ = app.asset_protocol_scope().allow_directory(path, true);
                    } else {
                        let _ = app.asset_protocol_scope().allow_file(path);
                    }
                }
                let _ = window.emit("drag-drop", paths);
            }
        })
        .invoke_handler(tauri::generate_handler![
            pick_folder,
            pick_files,
            scan_folders,
            get_cover,
            get_lyrics,
            download_lyrics,
            edit_metadata,
            read_tracks,
            allow_paths,
            load_state,
            save_state,
            set_close_to_tray,
            set_always_on_top,
            toggle_mini,
            show_main,
            reveal_in_dir,
            set_fullscreen,
            export_m3u,
            open_url,
            download_url,
            export_settings,
            import_settings,
            pick_image,
            media::media_update_metadata,
            media::media_update_playback
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
