use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{path::BaseDirectory, AppHandle, Manager};

const CHATS_DIR_NAME: &str = "chats";
const CHAT_INDEX_FILE_NAME: &str = "index.json";
const LEGACY_CHAT_HISTORY_FILE_NAME: &str = "chat-history.json";
const MAX_SESSIONS: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatIndexEntry {
    id: String,
    title: String,
    model: String,
    connection_id: String,
    db_type: String,
    created_at: i64,
    updated_at: i64,
}

struct ChatPaths {
    chat_dir: PathBuf,
    chat_index: PathBuf,
    legacy_history: PathBuf,
}

fn paths_from_root(root: &Path) -> ChatPaths {
    let chat_dir = root.join(CHATS_DIR_NAME);
    ChatPaths {
        chat_index: chat_dir.join(CHAT_INDEX_FILE_NAME),
        chat_dir,
        legacy_history: root.join(LEGACY_CHAT_HISTORY_FILE_NAME),
    }
}

fn chat_paths(app: &AppHandle) -> Result<ChatPaths, String> {
    let root = app
        .path()
        .resolve("", BaseDirectory::AppConfig)
        .map_err(|error| format!("failed to resolve app config path: {error}"))?;
    Ok(paths_from_root(&root))
}

async fn ensure_dir(path: &Path) -> Result<(), String> {
    tokio::fs::create_dir_all(path)
        .await
        .map_err(|error| format!("failed to create chats directory: {error}"))
}

async fn write_json_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "path has no parent directory".to_string())?;
    tokio::fs::create_dir_all(parent)
        .await
        .map_err(|error| format!("failed to create parent directory: {error}"))?;

    let temp_path = path.with_extension("json.tmp");
    tokio::fs::write(&temp_path, bytes)
        .await
        .map_err(|error| format!("failed to write temp file: {error}"))?;

    if path.exists() {
        tokio::fs::remove_file(path)
            .await
            .map_err(|error| format!("failed to replace file: {error}"))?;
    }

    tokio::fs::rename(&temp_path, path)
        .await
        .map_err(|error| format!("failed to finalize file: {error}"))
}

fn is_valid_chat_id(chat_id: &str) -> bool {
    !chat_id.is_empty()
        && chat_id.len() <= 128
        && chat_id.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
}

fn get_string_field(session: &Value, key: &str) -> Option<String> {
    session.get(key)?.as_str().map(ToString::to_string)
}

fn get_i64_field(session: &Value, key: &str) -> Option<i64> {
    let value = session.get(key)?;
    if let Some(number) = value.as_i64() {
        return Some(number);
    }
    if let Some(number) = value.as_u64() {
        return i64::try_from(number).ok();
    }
    None
}

fn now_millis_i64() -> i64 {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    i64::try_from(millis).unwrap_or(i64::MAX)
}

fn session_to_index_entry(session: &Value) -> Option<ChatIndexEntry> {
    let id = get_string_field(session, "id")?;
    if !is_valid_chat_id(&id) {
        return None;
    }

    Some(ChatIndexEntry {
        id,
        title: get_string_field(session, "title").unwrap_or_else(|| "New Chat".to_string()),
        model: get_string_field(session, "model").unwrap_or_else(|| "gpt-5".to_string()),
        connection_id: get_string_field(session, "connectionId").unwrap_or_default(),
        db_type: get_string_field(session, "dbType").unwrap_or_else(|| "postgres".to_string()),
        created_at: get_i64_field(session, "createdAt").unwrap_or_else(now_millis_i64),
        updated_at: get_i64_field(session, "updatedAt").unwrap_or_else(now_millis_i64),
    })
}

fn limit_sessions(sessions: &[Value]) -> Vec<Value> {
    let start = sessions.len().saturating_sub(MAX_SESSIONS);
    sessions[start..].to_vec()
}

fn sort_index_desc(entries: &mut [ChatIndexEntry]) {
    entries.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
}

fn session_file_path(chat_dir: &Path, chat_id: &str) -> PathBuf {
    chat_dir.join(format!("{chat_id}.json"))
}

async fn write_sessions_and_index(
    paths: &ChatPaths,
    sessions: &[Value],
) -> Result<Vec<Value>, String> {
    ensure_dir(&paths.chat_dir).await?;

    let limited = limit_sessions(sessions);
    let mut index_entries: Vec<ChatIndexEntry> = Vec::new();
    let mut seen_ids: HashSet<String> = HashSet::new();

    for session in &limited {
        let Some(index_entry) = session_to_index_entry(session) else {
            continue;
        };

        let session_bytes = serde_json::to_vec_pretty(session)
            .map_err(|error| format!("failed to serialize chat session: {error}"))?;
        let session_path = session_file_path(&paths.chat_dir, &index_entry.id);
        write_json_atomic(&session_path, &session_bytes).await?;

        seen_ids.insert(index_entry.id.clone());
        index_entries.push(index_entry);
    }

    let mut dir = tokio::fs::read_dir(&paths.chat_dir)
        .await
        .map_err(|error| format!("failed to read chats directory: {error}"))?;
    while let Some(entry) = dir
        .next_entry()
        .await
        .map_err(|error| format!("failed to iterate chats directory: {error}"))?
    {
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();
        if file_name == CHAT_INDEX_FILE_NAME || !file_name.ends_with(".json") {
            continue;
        }
        let Some(chat_id) = file_name.strip_suffix(".json") else {
            continue;
        };
        if seen_ids.contains(chat_id) {
            continue;
        }

        tokio::fs::remove_file(entry.path())
            .await
            .map_err(|error| format!("failed to remove stale chat file: {error}"))?;
    }

    sort_index_desc(&mut index_entries);
    let index_bytes = serde_json::to_vec_pretty(&index_entries)
        .map_err(|error| format!("failed to serialize chats index: {error}"))?;
    write_json_atomic(&paths.chat_index, &index_bytes).await?;

    Ok(limited)
}

async fn scan_sessions_from_directory(paths: &ChatPaths) -> Result<Vec<Value>, String> {
    ensure_dir(&paths.chat_dir).await?;
    let mut sessions: Vec<Value> = Vec::new();

    let mut dir = tokio::fs::read_dir(&paths.chat_dir)
        .await
        .map_err(|error| format!("failed to read chats directory: {error}"))?;
    while let Some(entry) = dir
        .next_entry()
        .await
        .map_err(|error| format!("failed to iterate chats directory: {error}"))?
    {
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();
        if file_name == CHAT_INDEX_FILE_NAME || !file_name.ends_with(".json") {
            continue;
        }

        let raw = tokio::fs::read_to_string(entry.path())
            .await
            .map_err(|error| format!("failed to read chat file: {error}"))?;
        if let Ok(session) = serde_json::from_str::<Value>(&raw) {
            sessions.push(session);
        }
    }

    sessions.sort_by(|left, right| {
        let left_updated = get_i64_field(left, "updatedAt").unwrap_or_default();
        let right_updated = get_i64_field(right, "updatedAt").unwrap_or_default();
        right_updated.cmp(&left_updated)
    });

    Ok(limit_sessions(&sessions))
}

async fn migrate_legacy_chat_history_if_needed(paths: &ChatPaths) -> Result<(), String> {
    ensure_dir(&paths.chat_dir).await?;

    let has_index = paths.chat_index.exists();

    let mut has_chat_files = false;
    let mut dir = tokio::fs::read_dir(&paths.chat_dir)
        .await
        .map_err(|error| format!("failed to read chats directory: {error}"))?;
    while let Some(entry) = dir
        .next_entry()
        .await
        .map_err(|error| format!("failed to iterate chats directory: {error}"))?
    {
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();
        if file_name != CHAT_INDEX_FILE_NAME && file_name.ends_with(".json") {
            has_chat_files = true;
            break;
        }
    }

    if has_index || has_chat_files || !paths.legacy_history.exists() {
        return Ok(());
    }

    let raw = tokio::fs::read_to_string(&paths.legacy_history)
        .await
        .map_err(|error| format!("failed to read legacy chat history: {error}"))?;
    let legacy_sessions = serde_json::from_str::<Vec<Value>>(&raw).unwrap_or_default();
    let _ = write_sessions_and_index(paths, &legacy_sessions).await?;

    tokio::fs::remove_file(&paths.legacy_history)
        .await
        .map_err(|error| format!("failed to remove legacy chat history file: {error}"))?;
    Ok(())
}

async fn load_chat_history_from_paths(paths: &ChatPaths) -> Result<Vec<Value>, String> {
    migrate_legacy_chat_history_if_needed(paths).await?;

    if paths.chat_index.exists() {
        let raw = tokio::fs::read_to_string(&paths.chat_index)
            .await
            .map_err(|error| format!("failed to read chats index: {error}"))?;
        if let Ok(mut index_entries) = serde_json::from_str::<Vec<ChatIndexEntry>>(&raw) {
            sort_index_desc(&mut index_entries);
            let mut sessions: Vec<Value> = Vec::new();

            for entry in index_entries.into_iter().take(MAX_SESSIONS) {
                let session_path = session_file_path(&paths.chat_dir, &entry.id);
                if !session_path.exists() {
                    continue;
                }
                let session_raw = tokio::fs::read_to_string(session_path)
                    .await
                    .map_err(|error| format!("failed to read chat session: {error}"))?;
                if let Ok(session) = serde_json::from_str::<Value>(&session_raw) {
                    sessions.push(session);
                }
            }

            let _ = write_sessions_and_index(paths, &sessions).await?;
            return Ok(sessions);
        }
    }

    let scanned = scan_sessions_from_directory(paths).await?;
    let _ = write_sessions_and_index(paths, &scanned).await?;
    Ok(scanned)
}

pub async fn load_chat_history(app: &AppHandle) -> Result<Vec<Value>, String> {
    let paths = chat_paths(app)?;
    load_chat_history_from_paths(&paths).await
}

pub async fn save_chat_history(app: &AppHandle, sessions: &[Value]) -> Result<Vec<Value>, String> {
    let paths = chat_paths(app)?;
    write_sessions_and_index(&paths, sessions).await
}

#[tauri::command]
pub async fn get_chat_history(app: AppHandle) -> Result<Vec<Value>, String> {
    load_chat_history(&app).await
}

#[tauri::command]
pub async fn set_chat_history(app: AppHandle, sessions: Vec<Value>) -> Result<Vec<Value>, String> {
    save_chat_history(&app, &sessions).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn temp_root() -> PathBuf {
        let mut root = std::env::temp_dir();
        root.push(format!("querystudio-chat-test-{}", Uuid::new_v4()));
        root
    }

    fn session(id: &str, updated_at: i64) -> Value {
        serde_json::json!({
            "id": id,
            "title": format!("Chat {id}"),
            "messages": [],
            "model": "gpt-5",
            "connectionId": "conn-1",
            "dbType": "postgres",
            "createdAt": updated_at - 10,
            "updatedAt": updated_at
        })
    }

    #[tokio::test]
    async fn writes_sessions_as_individual_files() {
        let root = temp_root();
        let paths = paths_from_root(&root);
        let saved = write_sessions_and_index(&paths, &[session("a", 1), session("b", 2)])
            .await
            .expect("save sessions");

        assert_eq!(saved.len(), 2);
        assert!(session_file_path(&paths.chat_dir, "a").exists());
        assert!(session_file_path(&paths.chat_dir, "b").exists());
        assert!(paths.chat_index.exists());
    }

    #[tokio::test]
    async fn migrates_legacy_file_into_chats_folder() {
        let root = temp_root();
        let paths = paths_from_root(&root);
        ensure_dir(&root).await.expect("create root");

        let legacy_json = serde_json::to_vec_pretty(&vec![session("legacy", 42)]).expect("json");
        write_json_atomic(&paths.legacy_history, &legacy_json)
            .await
            .expect("write legacy");

        let loaded = load_chat_history_from_paths(&paths)
            .await
            .expect("load/migrate");
        assert_eq!(loaded.len(), 1);
        assert!(session_file_path(&paths.chat_dir, "legacy").exists());
        assert!(!paths.legacy_history.exists());
    }
}
