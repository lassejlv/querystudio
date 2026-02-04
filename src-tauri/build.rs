use std::process::Command;

fn main() {
    // Collect build metadata and pass it via environment variables
    let git_hash = Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_else(|| "unknown".into());

    let git_branch = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_else(|| "unknown".into());

    let git_dirty = Command::new("git")
        .args(["status", "--porcelain"])
        .output()
        .ok()
        .map(|o| if o.stdout.is_empty() { "" } else { "-dirty" })
        .unwrap_or("");

    let build_timestamp = Command::new("date")
        .args(["+%Y-%m-%d %H:%M:%S"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_else(|| "unknown".into());

    let rustc_version = Command::new("rustc")
        .args(["--version"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_else(|| "unknown".into());

    println!(
        "cargo:rustc-env=QS_GIT_HASH={}{}",
        git_hash.trim(),
        git_dirty
    );
    println!("cargo:rustc-env=QS_GIT_BRANCH={}", git_branch.trim());
    println!(
        "cargo:rustc-env=QS_BUILD_TIMESTAMP={}",
        build_timestamp.trim()
    );
    println!("cargo:rustc-env=QS_RUSTC_VERSION={}", rustc_version.trim());
    println!(
        "cargo:rustc-env=QS_BUILD_PROFILE={}",
        if cfg!(debug_assertions) {
            "debug"
        } else {
            "release"
        }
    );

    tauri_build::build()
}
