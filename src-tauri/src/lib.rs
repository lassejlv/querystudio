mod ai;
mod database;
mod providers;
mod storage;

use ai::{ai_chat, ai_chat_stream, ai_get_models, ai_validate_key};
use database::{test_connection, ConnectionConfig, ConnectionManager};
use providers::{ColumnInfo, QueryResult, TableInfo};
use std::sync::Arc;
use storage::{SavedConnection, SavedConnections};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, State,
};

type DbState = Arc<ConnectionManager>;

#[tauri::command]
async fn connect(
    state: State<'_, DbState>,
    id: String,
    config: ConnectionConfig,
) -> Result<(), String> {
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
async fn get_saved_connections(app_handle: AppHandle) -> Result<SavedConnections, String> {
    storage::load_connections(&app_handle)
}

#[tauri::command]
async fn save_connection(app_handle: AppHandle, connection: SavedConnection) -> Result<(), String> {
    storage::add_connection(&app_handle, connection)
}

#[tauri::command]
async fn delete_saved_connection(app_handle: AppHandle, id: String) -> Result<(), String> {
    storage::remove_connection(&app_handle, &id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_state: DbState = Arc::new(ConnectionManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(db_state)
        .setup(|app| {
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
            // Storage commands
            get_saved_connections,
            save_connection,
            delete_saved_connection,
            // AI commands
            ai_get_models,
            ai_validate_key,
            ai_chat,
            ai_chat_stream,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
