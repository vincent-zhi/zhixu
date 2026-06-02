# 删除游戏和企业微信
$folders = @(
    "D:\1软件\son of forest",
    "D:\Softwere\Hearthstone",
    "C:\Program Files (x86)\WXWork"
)

foreach ($folder in $folders) {
    if (Test-Path $folder) {
        Write-Host "正在删除: $folder" -ForegroundColor Yellow
        try {
            Remove-Item -Path $folder -Recurse -Force -ErrorAction Stop
            Write-Host "✅ 已删除: $folder" -ForegroundColor Green
        } catch {
            Write-Host "❌ 删除失败: $folder - $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️ 不存在: $folder" -ForegroundColor Cyan
    }
}

Write-Host "`n完成！按任意键退出..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
