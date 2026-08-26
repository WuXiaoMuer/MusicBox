use std::sync::Mutex;
use std::time::Duration;

use souvlaki::{
    MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition, PlatformConfig,
};
use tauri::{AppHandle, Emitter, Manager};

/// 全局媒体控制句柄，供命令更新元数据/播放状态。
pub struct MediaState(pub Mutex<Option<MediaControls>>);

pub fn init(app: &tauri::App) -> tauri::Result<()> {
    let handle: AppHandle = app.handle().clone();

    #[cfg(target_os = "windows")]
    let hwnd: Option<*mut std::ffi::c_void> = {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};
        app.get_webview_window("main").and_then(|w| {
            let handle = w.window_handle().ok()?;
            match handle.as_raw() {
                RawWindowHandle::Win32(h) => Some(h.hwnd.get() as *mut std::ffi::c_void),
                _ => None,
            }
        })
    };
    #[cfg(not(target_os = "windows"))]
    let hwnd: Option<*mut std::ffi::c_void> = None;

    let config = PlatformConfig {
        dbus_name: "musicbox",
        display_name: "MusicBox",
        hwnd,
    };

    let mut controls =
        MediaControls::new(config).map_err(|e| tauri::Error::Anyhow(e.into()))?;

    let _ = controls.attach(move |event: MediaControlEvent| {
        let payload = match event {
            MediaControlEvent::Play => "play".to_string(),
            MediaControlEvent::Pause => "pause".to_string(),
            MediaControlEvent::Toggle => "toggle".to_string(),
            MediaControlEvent::Next => "next".to_string(),
            MediaControlEvent::Previous => "prev".to_string(),
            MediaControlEvent::Raise => "raise".to_string(),
            MediaControlEvent::Quit => "quit".to_string(),
            MediaControlEvent::SetPosition(pos) => format!("seek:{}", pos.0.as_secs_f64()),
            _ => return,
        };
        let _ = handle.emit("media-event", payload);
    });

    app.manage(MediaState(Mutex::new(Some(controls))));
    Ok(())
}

#[tauri::command]
pub fn media_update_metadata(
    state: tauri::State<'_, MediaState>,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    duration: Option<f64>,
) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    if let Some(controls) = guard.as_mut() {
        let meta = MediaMetadata {
            title: title.as_deref(),
            artist: artist.as_deref(),
            album: album.as_deref(),
            cover_url: None,
            duration: duration.map(Duration::from_secs_f64),
        };
        controls.set_metadata(meta).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn media_update_playback(
    state: tauri::State<'_, MediaState>,
    playing: bool,
    position: Option<f64>,
) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    if let Some(controls) = guard.as_mut() {
        let progress = position.map(|s| MediaPosition(Duration::from_secs_f64(s)));
        let playback = if playing {
            MediaPlayback::Playing { progress }
        } else {
            MediaPlayback::Paused { progress }
        };
        controls.set_playback(playback).map_err(|e| e.to_string())?;
    }
    Ok(())
}
