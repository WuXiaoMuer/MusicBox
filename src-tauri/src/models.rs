use serde::{Deserialize, Serialize};

/// 一首音乐曲目的元数据，以绝对路径作为唯一标识。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    /// 时长（秒）
    pub duration: f64,
    /// 是否含内嵌封面
    pub has_cover: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: String,
    pub name: String,
    /// 曲目路径列表
    pub tracks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub volume: f64,
    /// "sequence" | "shuffle" | "repeatOne" | "repeatAll"
    pub play_mode: String,
    #[serde(default)]
    pub muted: bool,
    pub last_track: Option<String>,
    pub last_position: f64,
    /// 主题色，如 "#1db954"
    #[serde(default = "default_accent")]
    pub accent_color: String,
    /// "compact" | "normal" | "loose"
    #[serde(default = "default_density")]
    pub density: String,
    #[serde(default = "default_true")]
    pub show_backdrop: bool,
    /// "dark" | "light"
    #[serde(default = "default_theme")]
    pub theme: String,
    /// "rounded" | "square" | "round"
    #[serde(default = "default_cover_shape")]
    pub cover_shape: String,
    /// "narrow" | "standard" | "wide"
    #[serde(default = "default_sidebar_width")]
    pub sidebar_width: String,
    #[serde(default = "default_true")]
    pub show_album: bool,
    /// 毛玻璃（背景模糊）
    #[serde(default = "default_true")]
    pub glass: bool,
    /// "opaque" | "semi" | "clear"
    #[serde(default = "default_transparency")]
    pub transparency: String,
    /// "light" | "standard" | "strong"
    #[serde(default = "default_glass_blur")]
    pub glass_blur: String,
    /// 关闭按钮最小化到托盘
    #[serde(default = "default_true")]
    pub minimize_to_tray: bool,
    /// 主窗口置顶
    #[serde(default)]
    pub always_on_top: bool,
    /// "list" | "grid"
    #[serde(default = "default_library_view")]
    pub library_view: String,
    /// 界面动效
    #[serde(default = "default_true")]
    pub animations: bool,
    /// "slow" | "normal" | "fast"
    #[serde(default = "default_anim_speed")]
    pub anim_speed: String,
    /// 封面旋转
    #[serde(default = "default_true")]
    pub cover_spin: bool,
    /// 侧栏显示
    #[serde(default = "default_true")]
    pub sidebar_visible: bool,
    /// 自定义快捷键
    #[serde(default)]
    pub keybindings: serde_json::Value,
}

fn default_library_view() -> String {
    "list".into()
}

fn default_anim_speed() -> String {
    "normal".into()
}

fn default_accent() -> String {
    "#1db954".into()
}

fn default_density() -> String {
    "normal".into()
}

fn default_theme() -> String {
    "dark".into()
}

fn default_cover_shape() -> String {
    "rounded".into()
}

fn default_sidebar_width() -> String {
    "standard".into()
}

fn default_transparency() -> String {
    "semi".into()
}

fn default_glass_blur() -> String {
    "standard".into()
}

fn default_true() -> bool {
    true
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            volume: 0.8,
            play_mode: "sequence".into(),
            muted: false,
            last_track: None,
            last_position: 0.0,
            accent_color: default_accent(),
            density: default_density(),
            show_backdrop: default_true(),
            theme: default_theme(),
            cover_shape: default_cover_shape(),
            sidebar_width: default_sidebar_width(),
            show_album: default_true(),
            glass: default_true(),
            transparency: default_transparency(),
            glass_blur: default_glass_blur(),
            minimize_to_tray: default_true(),
            always_on_top: false,
            library_view: default_library_view(),
            animations: default_true(),
            anim_speed: default_anim_speed(),
            cover_spin: default_true(),
            sidebar_visible: default_true(),
            keybindings: serde_json::Value::Object(Default::default()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub current_queue: Vec<String>,
    pub queue_index: i64,
    pub next_queue: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub folders: Vec<String>,
    pub playlists: Vec<Playlist>,
    pub favorites: Vec<String>,
    #[serde(default)]
    pub settings: Settings,
    #[serde(default)]
    pub session: Session,
    /// 最近播放（路径，最新在前）
    #[serde(default)]
    pub history: Vec<String>,
    /// 搜索历史（最新在前）
    #[serde(default)]
    pub search_history: Vec<String>,
    /// 播放次数统计：path -> 次数
    #[serde(default)]
    pub play_counts: std::collections::HashMap<String, u32>,
}
