use std::sync::{Arc, Mutex};
use sysinfo::{Pid, System};
use tauri::{command, State};

pub struct DebugState {
    sys: Mutex<System>,
    pid: Pid,
}

impl DebugState {
    pub fn new() -> Self {
        let sys = System::new();
        let pid = Pid::from_u32(std::process::id());
        Self {
            sys: Mutex::new(sys),
            pid,
        }
    }
}

#[derive(serde::Serialize)]
pub struct ProcessStats {
    cpu_usage: f32,
    memory_usage: u64,
}

#[command]
pub fn get_process_stats(state: State<'_, Arc<DebugState>>) -> ProcessStats {
    let mut sys = state.sys.lock().unwrap();
    // Refresh only the specific process
    sys.refresh_process(state.pid);

    if let Some(process) = sys.process(state.pid) {
        ProcessStats {
            cpu_usage: process.cpu_usage(),
            memory_usage: process.memory(),
        }
    } else {
        ProcessStats {
            cpu_usage: 0.0,
            memory_usage: 0,
        }
    }
}
