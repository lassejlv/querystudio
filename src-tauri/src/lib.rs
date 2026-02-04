mod ai;
mod database;
mod debug;
mod providers;
mod storage;
mod terminal;
mod user_state;

use ai::{
    ai_chat, ai_chat_stream, ai_fetch_openrouter_models, ai_fetch_vercel_models, ai_get_models,
    ai_validate_key,
};
use database::{test_connection, ConnectionConfig, ConnectionManager};
use debug::{get_process_stats, DebugState};
use providers::{ColumnInfo, QueryResult, TableInfo};
use std::sync::Arc;
use storage::CONNECTIONS_DB;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, Manager, State,
};
use tauri_plugin_sql::{Migration, MigrationKind};
use terminal::{
    terminal_close, terminal_create, terminal_resize, terminal_write, TerminalManager,
    TerminalState,
};
use user_state::{
    create_user_state_manager, get_max_connections, get_user_status, is_user_pro,
    set_user_pro_status, UserState_,
};

type DbState = Arc<ConnectionManager>;

#[tauri::command]
async fn connect(
    state: State<'_, DbState>,
    user_state: State<'_, UserState_>,
    id: String,
    config: ConnectionConfig,
) -> Result<(), String> {
    let is_pro = user_state.is_pro().await;
    let max_connections = user_state.get_max_connections().await;

    let current_connections = state.connection_count();

    if current_connections >= max_connections {
        return Err(format!(
            "Connection limit reached. {} allows {} connections. {}",
            if is_pro { "Your plan" } else { "Free tier" },
            if max_connections == usize::MAX {
                "unlimited".to_string()
            } else {
                max_connections.to_string()
            },
            if is_pro {
                "Please disconnect an existing connection."
            } else {
                "Upgrade to Pro for unlimited connections."
            }
        ));
    }

    state.connect(id, config).await
}

#[tauri::command]
async fn disconnect(state: State<'_, DbState>, id: String) -> Result<(), String> {
    state.disconnect(&id)
}

#[tauri::command]
async fn test_connection_handler(config: ConnectionConfig) -> Result<(), String> {
    test_connection(config).await
}

#[tauri::command]
async fn list_tables(
    state: State<'_, DbState>,
    connection_id: String,
) -> Result<Vec<TableInfo>, String> {
    state.list_tables(&connection_id).await
}

#[tauri::command]
async fn get_table_columns(
    state: State<'_, DbState>,
    connection_id: String,
    schema: String,
    table: String,
) -> Result<Vec<ColumnInfo>, String> {
    state
        .get_table_columns(&connection_id, &schema, &table)
        .await
}

#[tauri::command]
async fn get_table_data(
    state: State<'_, DbState>,
    connection_id: String,
    schema: String,
    table: String,
    limit: i64,
    offset: i64,
) -> Result<QueryResult, String> {
    state
        .get_table_data(&connection_id, &schema, &table, limit, offset)
        .await
}

#[tauri::command]
async fn execute_query(
    state: State<'_, DbState>,
    connection_id: String,
    query: String,
) -> Result<QueryResult, String> {
    state.execute_query(&connection_id, &query).await
}

#[tauri::command]
async fn get_table_count(
    state: State<'_, DbState>,
    connection_id: String,
    schema: String,
    table: String,
) -> Result<i64, String> {
    state.get_table_count(&connection_id, &schema, &table).await
}

#[tauri::command]
async fn insert_document(
    state: State<'_, DbState>,
    connection_id: String,
    collection: String,
    document: String,
) -> Result<String, String> {
    state
        .insert_document(&connection_id, &collection, &document)
        .await
}

#[tauri::command]
async fn update_document(
    state: State<'_, DbState>,
    connection_id: String,
    collection: String,
    filter: String,
    update: String,
) -> Result<u64, String> {
    state
        .update_document(&connection_id, &collection, &filter, &update)
        .await
}

#[tauri::command]
async fn delete_document(
    state: State<'_, DbState>,
    connection_id: String,
    collection: String,
    filter: String,
) -> Result<u64, String> {
    state
        .delete_document(&connection_id, &collection, &filter)
        .await
}

#[tauri::command]
fn get_connection_count(state: State<'_, DbState>) -> usize {
    state.connection_count()
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_state: DbState = Arc::new(ConnectionManager::new());
    let terminal_state: TerminalState = Arc::new(TerminalManager::new());
    let debug_state = Arc::new(DebugState::new());

    // Define SQLite migrations for connections storage
    let migrations = vec![Migration {
        version: 1,
        description: "create_connections_table",
        sql: r#"
                CREATE TABLE IF NOT EXISTS connections (
                    id TEXT PRIMARY KEY NOT NULL,
                    name TEXT NOT NULL,
                    db_type TEXT NOT NULL DEFAULT 'postgres',
                    config_type TEXT NOT NULL,
                    connection_string TEXT,
                    host TEXT,
                    port INTEGER,
                    database TEXT,
                    username TEXT
                );
            "#,
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(CONNECTIONS_DB, migrations)
                .build(),
        )
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(db_state)
        .manage(terminal_state)
        .manage(debug_state)
        .setup(|app| {
            // Initialize user state manager
            let user_state_manager = create_user_state_manager();
            let user_state: UserState_ = Arc::new(user_state_manager);
            app.manage(user_state);

            // Create the menu
            let app_menu = Submenu::with_items(
                app,
                "QueryStudio",
                true,
                &[
                    &PredefinedMenuItem::about(app, Some("About QueryStudio"), None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, Some("Services"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, Some("Hide QueryStudio"))?,
                    &PredefinedMenuItem::hide_others(app, Some("Hide Others"))?,
                    &PredefinedMenuItem::show_all(app, Some("Show All"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, Some("Quit QueryStudio"))?,
                ],
            )?;

            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &MenuItem::with_id(
                        app,
                        "new_connection",
                        "New Connection",
                        true,
                        Some("CmdOrCtrl+N"),
                    )?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "disconnect", "Disconnect", true, Some("CmdOrCtrl+W"))?,
                ],
            )?;

            let edit_menu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, Some("Undo"))?,
                    &PredefinedMenuItem::redo(app, Some("Redo"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, Some("Cut"))?,
                    &PredefinedMenuItem::copy(app, Some("Copy"))?,
                    &PredefinedMenuItem::paste(app, Some("Paste"))?,
                    &PredefinedMenuItem::select_all(app, Some("Select All"))?,
                ],
            )?;

            let view_menu = Submenu::with_items(
                app,
                "View",
                true,
                &[
                    &MenuItem::with_id(app, "view_data", "Table Data", true, Some("CmdOrCtrl+1"))?,
                    &MenuItem::with_id(
                        app,
                        "view_query",
                        "Query Editor",
                        true,
                        Some("CmdOrCtrl+2"),
                    )?,
                    &MenuItem::with_id(app, "view_ai", "Querybuddy", true, Some("CmdOrCtrl+3"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "refresh", "Refresh", true, Some("CmdOrCtrl+R"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(
                        app,
                        "command_palette",
                        "Command Palette...",
                        true,
                        Some("CmdOrCtrl+K"),
                    )?,
                ],
            )?;

            let window_menu = Submenu::with_items(
                app,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, Some("Minimize"))?,
                    &PredefinedMenuItem::maximize(app, Some("Zoom"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::fullscreen(app, Some("Enter Full Screen"))?,
                ],
            )?;

            let help_menu = Submenu::with_items(
                app,
                "Help",
                true,
                &[&MenuItem::with_id(
                    app,
                    "documentation",
                    "Documentation",
                    true,
                    None::<&str>,
                )?],
            )?;

            let menu = Menu::with_items(
                app,
                &[
                    &app_menu,
                    &file_menu,
                    &edit_menu,
                    &view_menu,
                    &window_menu,
                    &help_menu,
                ],
            )?;

            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(move |app_handle, event| match event.id().as_ref() {
                "new_connection" => {
                    let _ = app_handle.emit("menu-event", "new_connection");
                }
                "disconnect" => {
                    let _ = app_handle.emit("menu-event", "disconnect");
                }
                "settings" => {
                    let _ = app_handle.emit("menu-event", "settings");
                }
                "view_data" => {
                    let _ = app_handle.emit("menu-event", "view_data");
                }
                "view_query" => {
                    let _ = app_handle.emit("menu-event", "view_query");
                }
                "view_ai" => {
                    let _ = app_handle.emit("menu-event", "view_ai");
                }
                "refresh" => {
                    let _ = app_handle.emit("menu-event", "refresh");
                }
                "command_palette" => {
                    let _ = app_handle.emit("menu-event", "command_palette");
                }
                "documentation" => {
                    let _ = app_handle.emit("menu-event", "documentation");
                }
                _ => {}
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Database commands
            connect,
            disconnect,
            test_connection_handler,
            list_tables,
            get_table_columns,
            get_table_data,
            execute_query,
            get_table_count,
            get_connection_count,
            // MongoDB document commands
            insert_document,
            update_document,
            delete_document,
            // AI commands
            ai_get_models,
            ai_validate_key,
            ai_chat,
            ai_chat_stream,
            ai_fetch_openrouter_models,
            ai_fetch_vercel_models,
            // User state commands
            set_user_pro_status,
            get_user_status,
            get_max_connections,
            is_user_pro,
            // Terminal commands
            terminal_create,
            terminal_write,
            terminal_resize,
            terminal_close,
            // Debug commands
            get_process_stats,
            // App info commands
            get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
