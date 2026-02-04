use log::{error, info};
use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

pub struct PtyInstance {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

pub struct TerminalManager {
    ptys: Mutex<HashMap<String, PtyInstance>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            ptys: Mutex::new(HashMap::new()),
        }
    }

    pub fn create_pty(
        &self,
        id: String,
        rows: u16,
        cols: u16,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let pty_system = native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open pty: {}", e))?;

        // Get the default shell
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

        // Use login shell to ensure profile files are sourced (e.g., .zprofile, .zshrc)
        // This is especially important on macOS where Homebrew sets up PATH in profile files
        let mut cmd = CommandBuilder::new(&shell);
        cmd.arg("-l"); // Login shell flag
        cmd.cwd(std::env::var("HOME").unwrap_or_else(|_| "/".to_string()));

        // Set TERM environment variable for proper terminal emulation
        cmd.env("TERM", "xterm-256color");

        // On macOS, ensure common Homebrew paths are available
        // This helps when the app is launched from Finder/Dock where PATH is minimal
        #[cfg(target_os = "macos")]
        {
            let current_path = std::env::var("PATH").unwrap_or_default();
            let homebrew_paths = [
                "/opt/homebrew/bin",  // Apple Silicon Homebrew
                "/opt/homebrew/sbin", // Apple Silicon Homebrew
                "/usr/local/bin",     // Intel Homebrew
                "/usr/local/sbin",    // Intel Homebrew
            ];

            let mut path_parts: Vec<&str> = homebrew_paths.to_vec();
            if !current_path.is_empty() {
                path_parts.push(&current_path);
            }
            // Add standard paths as fallback
            path_parts.extend(["/usr/bin", "/bin", "/usr/sbin", "/sbin"]);

            let new_path = path_parts.join(":");
            cmd.env("PATH", new_path);
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        // We don't need to track the child process directly
        drop(child);

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take writer: {}", e))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;

        let terminal_id = id.clone();
        let app = app_handle.clone();

        // Spawn a thread to read from the PTY and emit events
        thread::spawn(move || {
            let mut buffer = [0u8; 4096];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        let _ = app.emit(&format!("terminal-closed-{}", terminal_id), ());
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                        let _ = app.emit(&format!("terminal-output-{}", terminal_id), data);
                    }
                    Err(e) => {
                        error!("PTY read error [id={}]: {}", terminal_id, e);
                        let _ = app.emit(&format!("terminal-closed-{}", terminal_id), ());
                        break;
                    }
                }
            }
        });

        let instance = PtyInstance {
            master: pair.master,
            writer,
        };

        self.ptys.lock().insert(id.clone(), instance);
        info!("Terminal created [id={}] ({}x{})", id, cols, rows);

        Ok(id)
    }

    pub fn write_to_pty(&self, id: &str, data: &str) -> Result<(), String> {
        let mut ptys = self.ptys.lock();
        let pty = ptys
            .get_mut(id)
            .ok_or_else(|| format!("Terminal {} not found", id))?;

        pty.writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to pty: {}", e))?;

        pty.writer
            .flush()
            .map_err(|e| format!("Failed to flush pty: {}", e))?;

        Ok(())
    }

    pub fn resize_pty(&self, id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let ptys = self.ptys.lock();
        let pty = ptys
            .get(id)
            .ok_or_else(|| format!("Terminal {} not found", id))?;

        pty.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize pty: {}", e))?;

        Ok(())
    }

    pub fn close_pty(&self, id: &str) -> Result<(), String> {
        let mut ptys = self.ptys.lock();
        ptys.remove(id);
        info!("Terminal closed [id={}]", id);
        Ok(())
    }
}

pub type TerminalState = Arc<TerminalManager>;

#[tauri::command]
pub async fn terminal_create(
    state: State<'_, TerminalState>,
    app_handle: AppHandle,
    rows: u16,
    cols: u16,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    state.create_pty(id, rows, cols, app_handle)
}

#[tauri::command]
pub async fn terminal_write(
    state: State<'_, TerminalState>,
    id: String,
    data: String,
) -> Result<(), String> {
    state.write_to_pty(&id, &data)
}

#[tauri::command]
pub async fn terminal_resize(
    state: State<'_, TerminalState>,
    id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    state.resize_pty(&id, rows, cols)
}

#[tauri::command]
pub async fn terminal_close(state: State<'_, TerminalState>, id: String) -> Result<(), String> {
    state.close_pty(&id)
}
