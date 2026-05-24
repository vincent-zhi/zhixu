#[tauri::command]
fn platform_status() -> String {
    "Tauri runtime ready".to_string()
}

#[tauri::command]
fn select_local_file() -> Result<String, String> {
    Ok("dialog:open".to_string())
}

#[tauri::command]
fn get_server_url() -> String {
    std::env::var("ZHIXU_API_URL").unwrap_or_else(|_| "http://localhost:4000".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![platform_status, select_local_file, get_server_url])
        .run(tauri::generate_context!())
        .expect("error while running ZhiXu desktop app");
}
