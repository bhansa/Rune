mod bin_resolver;
mod companion;
mod fs;
mod leetcode;
mod python;

use companion::claude_cli::claude_cli_probe;
use companion::companion_complete;
use companion::ollama::ollama_list_models;
use fs::{exists, read_dir, read_file, write_file};
use leetcode::{leetcode_clear_cache, leetcode_get};
use python::run_python;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            read_dir,
            exists,
            run_python,
            companion_complete,
            ollama_list_models,
            claude_cli_probe,
            leetcode_get,
            leetcode_clear_cache
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
