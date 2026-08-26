use std::fs;
use std::path::PathBuf;

use tauri::Manager;

use crate::models::AppState;

fn state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {e}"))?;
    Ok(dir.join("state.json"))
}

pub fn load_state(app: &tauri::AppHandle) -> AppState {
    match state_path(app) {
        Ok(path) if path.exists() => fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default(),
        _ => AppState::default(),
    }
}

pub fn save_state(app: &tauri::AppHandle, state: &AppState) -> Result<(), String> {
    let path = state_path(app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("创建目录失败: {e}"))?;
    }
    let json = serde_json::to_string_pretty(state).map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("写入失败: {e}"))
}

#[derive(serde::Serialize, serde::Deserialize)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

fn window_state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {e}"))?;
    Ok(dir.join("window.json"))
}

pub fn save_window_state(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if let (Ok(pos), Ok(size)) = (w.outer_position(), w.outer_size()) {
            let st = WindowState {
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height,
                maximized: w.is_maximized().unwrap_or(false),
            };
            if let Ok(path) = window_state_path(app) {
                if let Some(dir) = path.parent() {
                    let _ = fs::create_dir_all(dir);
                }
                let _ = fs::write(&path, serde_json::to_string(&st).unwrap_or_default());
            }
        }
    }
}

pub fn load_window_state(app: &tauri::AppHandle) {
    if let Ok(path) = window_state_path(app) {
        if let Ok(s) = fs::read_to_string(&path) {
            if let Ok(st) = serde_json::from_str::<WindowState>(&s) {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.set_position(tauri::PhysicalPosition::new(st.x, st.y));
                    let _ = w.set_size(tauri::PhysicalSize::new(st.width, st.height));
                    if st.maximized {
                        let _ = w.maximize();
                    }
                }
            }
        }
    }
}
