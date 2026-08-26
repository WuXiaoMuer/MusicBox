use std::collections::HashSet;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use lofty::file::AudioFile;
use lofty::file::TaggedFileExt;
use lofty::probe::Probe;
use lofty::tag::{Accessor, ItemKey};
use walkdir::WalkDir;

use crate::models::Track;

const AUDIO_EXTS: [&str; 8] = ["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "ape"];

fn is_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| AUDIO_EXTS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// 递归扫描给定文件夹，返回所有音频文件的元数据。
pub fn scan_folders(folders: &[String]) -> Vec<Track> {
    let mut tracks = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for folder in folders {
        for entry in WalkDir::new(folder).follow_links(false) {
            let Ok(entry) = entry else { continue };
            if !entry.file_type().is_file() {
                continue;
            }
            let path = entry.path();
            if !is_audio(path) {
                continue;
            }
            let path_str = path.to_string_lossy().to_string();
            if !seen.insert(path_str) {
                continue;
            }
            if let Some(track) = read_track(path) {
                tracks.push(track);
            }
        }
    }

    tracks
}

fn read_tagged(path: &Path) -> Option<lofty::file::TaggedFile> {
    let probe = Probe::open(path).ok()?;
    probe.guess_file_type().ok()?.read().ok()
}

/// 读取指定文件列表的元数据（不递归）。
pub fn read_tracks(paths: &[String]) -> Vec<Track> {
    paths
        .iter()
        .filter_map(|p| read_track(Path::new(p)))
        .collect()
}

pub fn read_track(path: &Path) -> Option<Track> {
    let tagged = read_tagged(path)?;
    let duration = tagged.properties().duration().as_secs_f64();
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());

    let title;
    let artist;
    let album;
    let has_cover;

    match tag {
        Some(t) => {
            title = t
                .title()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| fallback_title(path));
            artist = t.artist().map(|s| s.trim().to_string()).unwrap_or_default();
            album = t.album().map(|s| s.trim().to_string()).unwrap_or_default();
            has_cover = !t.pictures().is_empty();
        }
        None => {
            title = fallback_title(path);
            artist = String::new();
            album = String::new();
            has_cover = false;
        }
    }

    Some(Track {
        path: path.to_string_lossy().to_string(),
        title,
        artist,
        album,
        duration,
        has_cover,
    })
}

fn fallback_title(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "未知曲目".into())
}

/// 读取内嵌封面，返回 base64 data URL。
pub fn get_cover(path: &str) -> Option<String> {
    let tagged = read_tagged(Path::new(path))?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;
    let pic = tag.pictures().first()?;
    let data = pic.data();
    if data.is_empty() {
        return None;
    }
    let mime = sniff_mime(data);
    Some(format!("data:{};base64,{}", mime, STANDARD.encode(data)))
}

fn sniff_mime(data: &[u8]) -> &'static str {
    if data.len() >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
        "image/jpeg"
    } else if data.len() >= 8 && &data[0..4] == b"\x89PNG" {
        "image/png"
    } else if data.len() >= 6 && &data[0..4] == b"GIF8" {
        "image/gif"
    } else if data.len() >= 12 && &data[0..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        "image/webp"
    } else if data.len() >= 2 && data[0] == 0x42 && data[1] == 0x4D {
        "image/bmp"
    } else {
        "image/jpeg"
    }
}

/// 读取歌词：优先同目录同名 .lrc 文件，其次内嵌标签歌词。
pub fn get_lyrics(path: &str) -> Option<String> {
    let p = Path::new(path);

    if let Some(lrc) = find_lrc_file(p) {
        if let Ok(bytes) = std::fs::read(&lrc) {
            if let Some(text) = decode_lrc(&bytes) {
                if !text.trim().is_empty() {
                    return Some(text);
                }
            }
        }
    }

    if let Some(tagged) = read_tagged(p) {
        if let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
            if let Some(lyrics) = tag.get_string(ItemKey::Lyrics) {
                if !lyrics.trim().is_empty() {
                    return Some(lyrics.to_string());
                }
            }
            if let Some(lyrics) = tag.get_string(ItemKey::UnsyncLyrics) {
                if !lyrics.trim().is_empty() {
                    return Some(lyrics.to_string());
                }
            }
        }
    }

    None
}

fn find_lrc_file(path: &Path) -> Option<PathBuf> {
    let stem = path.file_stem()?;
    let parent = path.parent()?;
    let name = format!("{}.lrc", stem.to_string_lossy());
    let candidate = parent.join(&name);
    candidate.exists().then_some(candidate)
}

/// 解码歌词文本：优先 UTF-8，失败回退 GBK。
fn decode_lrc(bytes: &[u8]) -> Option<String> {
    if let Ok(s) = std::str::from_utf8(bytes) {
        return Some(s.to_string());
    }
    let (cow, _, _) = encoding_rs::GBK.decode(bytes);
    Some(cow.into_owned())
}

/// 编辑并写回歌曲元数据（标题/歌手/专辑）。
pub fn edit_metadata(path: &str, title: &str, artist: &str, album: &str) -> Result<(), String> {
    use lofty::config::WriteOptions;
    use lofty::prelude::*;

    let p = Path::new(path);
    let mut tagged = lofty::read_from_path(p).map_err(|e| format!("读取失败: {e}"))?;
    let tag = if tagged.primary_tag().is_some() {
        tagged.primary_tag_mut()
    } else {
        tagged.first_tag_mut()
    };
    if let Some(tag) = tag {
        let t = title.trim().to_string();
        let a = artist.trim().to_string();
        let al = album.trim().to_string();
        if !t.is_empty() {
            tag.set_title(t);
        }
        if !a.is_empty() {
            tag.set_artist(a);
        }
        if !al.is_empty() {
            tag.set_album(al);
        }
        tag.save_to_path(p, WriteOptions::default())
            .map_err(|e| format!("写入失败: {e}"))?;
        Ok(())
    } else {
        Err("该文件没有可写入的标签".into())
    }
}

/// 从 lrclib 在线搜索歌词，成功则保存为同目录 .lrc 并返回。
pub fn download_lyrics(path: &str) -> Option<String> {
    let tagged = read_tagged(Path::new(path))?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());

    let title = tag
        .and_then(|t| t.title())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .or_else(|| Path::new(path).file_stem().map(|s| s.to_string_lossy().to_string()))?;
    let artist = tag.and_then(|t| t.artist()).map(|s| s.trim().to_string()).unwrap_or_default();
    let album = tag.and_then(|t| t.album()).map(|s| s.trim().to_string()).unwrap_or_default();

    let lyrics = fetch_lrclib(&title, &artist, &album)?;

    // 保存 .lrc，下次直接本地读取
    if let Some(parent) = Path::new(path).parent() {
        if let Some(stem) = Path::new(path).file_stem() {
            let lrc = parent.join(format!("{}.lrc", stem.to_string_lossy()));
            let _ = std::fs::write(&lrc, &lyrics);
        }
    }

    Some(lyrics)
}

fn fetch_lrclib(title: &str, artist: &str, album: &str) -> Option<String> {
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(6))
        .build();
    let resp = agent
        .get("https://lrclib.net/api/search")
        .query("track_name", title)
        .query("artist_name", artist)
        .query("album_name", album)
        .call()
        .ok()?;
    let json: serde_json::Value = resp.into_json().ok()?;
    let item = json.as_array()?.first()?;
    item.get("syncedLyrics")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            item.get("plainLyrics")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .filter(|s| !s.trim().is_empty())
}
