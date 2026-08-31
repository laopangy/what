[CmdletBinding()]
param(
    [switch]$Worker,
    [switch]$CheckOnly,
    [switch]$UiSmokeTest,
    [switch]$ForceShow,
    [string]$Items = "",
    [string]$ProjectRoot = "",
    [string]$StatusFile = "",
    [string]$LogFile = ""
)

$ErrorActionPreference = "Stop"

# Windows PowerShell 5.1 otherwise decodes native WinGet/npm output with the
# active OEM code page (often 936), even though those tools emit UTF-8.
try {
    $utf8Encoding = New-Object System.Text.UTF8Encoding($false)
    [Console]::InputEncoding = $utf8Encoding
    [Console]::OutputEncoding = $utf8Encoding
    $global:OutputEncoding = $utf8Encoding
    & "$env:SystemRoot\System32\chcp.com" 65001 | Out-Null
} catch { }

trap {
    $message = "本地环境安装器启动失败。`r`n`r`n$($_.Exception.Message)"
    try {
        $errorLog = Join-Path ([System.IO.Path]::GetTempPath()) "what-setup-error.log"
        Set-Content -LiteralPath $errorLog -Value ("$(Get-Date -Format o)`r`n$($_ | Out-String)") -Encoding UTF8
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
        [System.Windows.Forms.MessageBox]::Show("$message`r`n`r`n错误日志：$errorLog", "启动失败", "OK", "Error") | Out-Null
    } catch { }
    exit 1
}

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = (@($machinePath, $userPath) | Where-Object { $_ }) -join ";"
}

function Find-Executable {
    param(
        [Parameter(Mandatory = $true)][string[]]$Names,
        [string[]]$Candidates = @()
    )

    foreach ($name in $Names) {
        $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command -and $command.Source) { return $command.Source }
    }
    foreach ($candidate in $Candidates) {
        $expanded = [Environment]::ExpandEnvironmentVariables($candidate)
        if (Test-Path -LiteralPath $expanded) { return $expanded }
    }
    return $null
}

function Get-CommandVersion {
    param([string]$Path, [string[]]$Arguments = @("--version"))
    if (-not $Path) { return $null }
    try {
        $value = & $Path @Arguments 2>$null | Select-Object -First 1
        if ($value) { return "$value".Trim() }
    } catch { }
    return $null
}

function Get-NpmPath {
    $nodePath = Find-Executable -Names @("node.exe", "node") -Candidates @(
        "$env:ProgramFiles\nodejs\node.exe"
    )
    if (-not $nodePath) { return $null }
    $besideNode = Join-Path (Split-Path -Parent $nodePath) "npm.cmd"
    return Find-Executable -Names @("npm.cmd", "npm") -Candidates @($besideNode)
}

function Get-EnvFileValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Key
    )
    if (-not (Test-Path -LiteralPath $Path)) { return "" }
    $escapedKey = [Regex]::Escape($Key)
    $line = Get-Content -LiteralPath $Path -Encoding UTF8 -ErrorAction SilentlyContinue |
        Where-Object { $_ -match "^$escapedKey=" } | Select-Object -Last 1
    if (-not $line) { return "" }
    return ($line -replace "^$escapedKey=", "").Trim()
}

function Test-ApiKeyValue {
    param([AllowEmptyString()][string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value.Length -lt 10) { return $false }
    return $Value -cmatch '^[\x20-\x7E]+$'
}

function Test-ProjectDependencies {
    $projectDirectories = @("", "Music", "workbench", "Tools", "Fitness")
    $staleProjects = New-Object 'System.Collections.Generic.List[string]'
    $missingPackages = New-Object 'System.Collections.Generic.List[string]'

    foreach ($relativeDirectory in $projectDirectories) {
        $directory = if ([string]::IsNullOrWhiteSpace($relativeDirectory)) {
            $ProjectRoot
        } else {
            Join-Path $ProjectRoot $relativeDirectory
        }
        $lockPath = Join-Path $directory "package-lock.json"
        $installedLockPath = Join-Path $directory "node_modules\.package-lock.json"
        $displayName = if ($relativeDirectory) { $relativeDirectory } else { "根目录" }

        if (-not (Test-Path -LiteralPath $lockPath) -or -not (Test-Path -LiteralPath $installedLockPath)) {
            $staleProjects.Add($displayName)
            continue
        }
        $lockTime = (Get-Item -LiteralPath $lockPath).LastWriteTimeUtc
        $installedTime = (Get-Item -LiteralPath $installedLockPath).LastWriteTimeUtc
        if ($lockTime -gt $installedTime) {
            $staleProjects.Add($displayName)
        }
    }

    # A current hidden lock file normally proves npm completed, while checking
    # every direct dependency also catches manually removed or partially copied
    # node_modules directories. Resolve packages upward just like Node/npm does.
    $manifestPaths = New-Object 'System.Collections.Generic.List[string]'
    foreach ($relativeDirectory in $projectDirectories) {
        $directory = if ([string]::IsNullOrWhiteSpace($relativeDirectory)) {
            $ProjectRoot
        } else {
            Join-Path $ProjectRoot $relativeDirectory
        }
        $rootManifest = Join-Path $directory "package.json"
        if (Test-Path -LiteralPath $rootManifest) { $manifestPaths.Add($rootManifest) }
        Get-ChildItem -LiteralPath $directory -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -ne "node_modules" } |
            ForEach-Object {
                $childManifest = Join-Path $_.FullName "package.json"
                if (Test-Path -LiteralPath $childManifest) { $manifestPaths.Add($childManifest) }
            }
    }

    foreach ($manifestPath in $manifestPaths) {
        try {
            $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        } catch {
            $missingPackages.Add("无法读取 $manifestPath")
            continue
        }
        $dependencyNames = @()
        foreach ($sectionName in @("dependencies", "devDependencies")) {
            $section = $manifest.$sectionName
            if ($section) { $dependencyNames += @($section.PSObject.Properties.Name) }
        }
        foreach ($packageName in ($dependencyNames | Sort-Object -Unique)) {
            $searchDirectory = Split-Path -Parent $manifestPath
            $resolved = $false
            while ($searchDirectory -and $searchDirectory.StartsWith($ProjectRoot, [StringComparison]::OrdinalIgnoreCase)) {
                $candidate = Join-Path (Join-Path $searchDirectory "node_modules") $packageName
                if (Test-Path -LiteralPath $candidate) {
                    $resolved = $true
                    break
                }
                if ([string]::Equals($searchDirectory, $ProjectRoot, [StringComparison]::OrdinalIgnoreCase)) { break }
                $searchDirectory = Split-Path -Parent $searchDirectory
            }
            if (-not $resolved) {
                $relativeManifest = $manifestPath.Substring($ProjectRoot.Length).TrimStart('\')
                $missingPackages.Add("$relativeManifest -> $packageName")
            }
        }
    }

    $ready = $staleProjects.Count -eq 0 -and $missingPackages.Count -eq 0
    $details = New-Object 'System.Collections.Generic.List[string]'
    if ($staleProjects.Count -gt 0) { $details.Add("需更新：$($staleProjects -join '、')") }
    if ($missingPackages.Count -gt 0) {
        $preview = @($missingPackages | Select-Object -First 3) -join "；"
        if ($missingPackages.Count -gt 3) { $preview += " 等 $($missingPackages.Count) 项" }
        $details.Add("缺少：$preview")
    }
    if ($ready) { $details.Add("锁文件与直接依赖均已校验") }

    return [ordered]@{
        Ready = $ready
        Detail = $details -join "；"
    }
}

function Get-EnvironmentState {
    Refresh-ProcessPath

    $nodePath = Find-Executable -Names @("node.exe", "node") -Candidates @(
        "$env:ProgramFiles\nodejs\node.exe"
    )
    $nodeVersion = Get-CommandVersion -Path $nodePath
    $nodeMajor = 0
    if ($nodeVersion -match '^v?(\d+)') { $nodeMajor = [int]$Matches[1] }
    $nodeReady = [bool]$nodePath -and $nodeMajor -ge 22

    $gitPath = Find-Executable -Names @("git.exe", "git") -Candidates @(
        "$env:ProgramFiles\Git\cmd\git.exe",
        "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
        "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
    )
    $gitVersion = Get-CommandVersion -Path $gitPath

    $mpvPath = Find-Executable -Names @("mpv.com", "mpv.exe", "mpv") -Candidates @(
        "$env:ProgramFiles\MPV Player\mpv.com",
        "$env:ProgramFiles\MPV Player\mpv.exe",
        "$env:ProgramFiles\mpv\mpv.com",
        "$env:ProgramFiles\mpv\mpv.exe",
        "${env:ProgramFiles(x86)}\mpv\mpv.com"
    )
    $mpvVersion = Get-CommandVersion -Path $mpvPath

    $ncmPath = Find-Executable -Names @("ncm-cli.cmd", "ncm-cli") -Candidates @(
        "$env:APPDATA\npm\ncm-cli.cmd",
        (Join-Path $ProjectRoot "Music\node_modules\.bin\ncm-cli.cmd")
    )
    $ncmVersion = Get-CommandVersion -Path $ncmPath

    $dependencyState = Test-ProjectDependencies
    $dependenciesReady = $dependencyState.Ready

    $musicEnv = Join-Path $ProjectRoot "Music\server\.env"
    $workbenchEnv = Join-Path $ProjectRoot "workbench\server\.env"
    $envReady = (Test-Path -LiteralPath $musicEnv) -and (Test-Path -LiteralPath $workbenchEnv)
    $musicApiKey = Get-EnvFileValue -Path $musicEnv -Key "ANTHROPIC_AUTH_TOKEN"
    $workbenchApiKey = Get-EnvFileValue -Path $workbenchEnv -Key "ANTHROPIC_AUTH_TOKEN"
    $apiKeyReady = (Test-ApiKeyValue $musicApiKey) -and (Test-ApiKeyValue $workbenchApiKey)

    return [ordered]@{
        Node = [ordered]@{
            Installed = $nodeReady
            Version = if ($nodeVersion) { $nodeVersion } else { "未安装" }
            Detail = if ($nodePath -and -not $nodeReady) { "需要 Node.js 22 或更高版本" } else { $nodePath }
        }
        Git = [ordered]@{
            Installed = [bool]$gitPath
            Version = if ($gitVersion) { $gitVersion } else { "未安装（可选）" }
            Detail = $gitPath
        }
        Mpv = [ordered]@{
            Installed = [bool]$mpvPath
            Version = if ($mpvVersion) { $mpvVersion } else { "未安装" }
            Detail = $mpvPath
        }
        Ncm = [ordered]@{
            Installed = [bool]$ncmPath
            Version = if ($ncmVersion) { $ncmVersion } else { "未安装" }
            Detail = $ncmPath
        }
        Dependencies = [ordered]@{
            Installed = $dependenciesReady
            Version = if ($dependenciesReady) { "已安装且已校验" } else { "需要更新" }
            Detail = $dependencyState.Detail
        }
        Environment = [ordered]@{
            Installed = $envReady
            Version = if ($envReady) { "已配置" } else { "待配置" }
            Detail = "Music/server/.env、workbench/server/.env"
        }
        ApiKey = [ordered]@{
            Installed = $apiKeyReady
            Version = if ($apiKeyReady) { "已配置" } else { "未配置" }
            Detail = "DeepSeek API Key（不会显示或写入日志）"
        }
    }
}

function Test-AllSetupReady {
    param($State)
    if (-not $State) { return $false }
    return [bool](
        $State.Node.Installed -and
        $State.Mpv.Installed -and
        $State.Ncm.Installed -and
        $State.Dependencies.Installed -and
        $State.Environment.Installed -and
        $State.ApiKey.Installed
    )
}

function Get-SetupPreferencePath {
    if (-not [string]::IsNullOrWhiteSpace($env:WHAT_SETUP_PREFERENCE_PATH)) {
        return [System.IO.Path]::GetFullPath($env:WHAT_SETUP_PREFERENCE_PATH)
    }
    $base = Join-Path $env:LOCALAPPDATA "WhatToolStack"
    return Join-Path $base "setup-preferences.json"
}

function Get-SetupPreference {
    $path = Get-SetupPreferencePath
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    try {
        $preference = Get-Content -LiteralPath $path -Encoding UTF8 -Raw | ConvertFrom-Json
        $sameProject = -not $preference.ProjectRoot -or
            [string]::Equals([System.IO.Path]::GetFullPath([string]$preference.ProjectRoot), $ProjectRoot, [StringComparison]::OrdinalIgnoreCase)
        if ($sameProject) { return $preference }
    } catch { }
    return $null
}

function Get-SkipInstallerPreference {
    $preference = Get-SetupPreference
    return $null -ne $preference -and $preference.SkipWhenReady -eq $true
}

function Get-AutoClosePreference {
    $preference = Get-SetupPreference
    if ($null -eq $preference -or $null -eq $preference.AutoCloseAfterStart) { return $true }
    return $preference.AutoCloseAfterStart -eq $true
}

function Write-SetupPreference {
    param(
        [bool]$SkipWhenReady,
        [bool]$AutoCloseAfterStart
    )
    $path = Get-SetupPreferencePath
    $parent = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [ordered]@{
        SkipWhenReady = $SkipWhenReady
        AutoCloseAfterStart = $AutoCloseAfterStart
        UpdatedAt = (Get-Date).ToString("o")
        ProjectRoot = $ProjectRoot
    } | ConvertTo-Json | Set-Content -LiteralPath $path -Encoding UTF8
}

function Set-SkipInstallerPreference {
    param([bool]$Enabled)
    Write-SetupPreference -SkipWhenReady $Enabled -AutoCloseAfterStart (Get-AutoClosePreference)
}

function Set-AutoClosePreference {
    param([bool]$Enabled)
    Write-SetupPreference -SkipWhenReady (Get-SkipInstallerPreference) -AutoCloseAfterStart $Enabled
}

function Start-ProjectProcess {
    $npm = Get-NpmPath
    if (-not $npm) { throw "未找到 npm，请先完成 Node.js 安装" }
    $command = "cd /d `"$ProjectRoot`" && `"$npm`" run dev"
    Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $command) -WorkingDirectory $ProjectRoot -WindowStyle Hidden | Out-Null
}

function Write-WorkerLog {
    param([string]$Message)
    if ($LogFile) {
        $timestamp = Get-Date -Format "HH:mm:ss"
        Add-Content -LiteralPath $LogFile -Value "[$timestamp] $Message" -Encoding UTF8
    }
}

function Write-WorkerStatus {
    param(
        [string]$Item,
        [string]$State,
        [string]$Message,
        [int]$Progress
    )
    if (-not $StatusFile) { return }
    $record = [ordered]@{
        Time = (Get-Date).ToString("o")
        Item = $Item
        State = $State
        Message = $Message
        Progress = [Math]::Max(0, [Math]::Min(100, $Progress))
    }
    Add-Content -LiteralPath $StatusFile -Value ($record | ConvertTo-Json -Compress) -Encoding UTF8
}

function Invoke-LoggedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @()
    )
    Write-WorkerLog "执行：$FilePath $($Arguments -join ' ')"
    $previousErrorAction = $ErrorActionPreference
    try {
        # npm writes warnings to stderr. They are log lines, not PowerShell
        # failures; only the native process exit code decides success.
        $ErrorActionPreference = "Continue"
        & $FilePath @Arguments 2>&1 | ForEach-Object { Write-WorkerLog "$($_)" }
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($null -eq $exitCode) { $exitCode = 0 }
    if ($exitCode -ne 0) { throw "命令执行失败，退出代码：$exitCode" }
}

function Invoke-NpmInstallWithRetry {
    param(
        [Parameter(Mandatory = $true)][string]$NpmPath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$Description
    )

    # Nested npm commands inherit these settings, including the workspace
    # installs launched by the root postinstall script.
    $settings = [ordered]@{
        npm_config_fetch_retries = "3"
        npm_config_fetch_retry_factor = "2"
        npm_config_fetch_retry_mintimeout = "10000"
        npm_config_fetch_retry_maxtimeout = "60000"
        npm_config_fetch_timeout = "120000"
        npm_config_loglevel = "info"
        npm_config_progress = "true"
    }
    $previous = @{}
    foreach ($name in $settings.Keys) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
        [Environment]::SetEnvironmentVariable($name, $settings[$name], "Process")
    }
    $previousRegistry = [Environment]::GetEnvironmentVariable("npm_config_registry", "Process")

    try {
        Write-WorkerLog "${Description}：优先使用 npmmirror 国内镜像；失败时会自动切换 npm 官方源。"
        try {
            [Environment]::SetEnvironmentVariable("npm_config_registry", "https://registry.npmmirror.com/", "Process")
            Invoke-LoggedCommand -FilePath $NpmPath -Arguments $Arguments
            return
        } catch {
            Write-WorkerLog "$Description 使用 npmmirror 失败：$($_.Exception.Message)"
            Write-WorkerLog "正在切换到 npm 官方源并自动重试，请勿关闭安装器。"
        }

        [Environment]::SetEnvironmentVariable("npm_config_registry", "https://registry.npmjs.org/", "Process")
        Invoke-LoggedCommand -FilePath $NpmPath -Arguments $Arguments
    } finally {
        foreach ($name in $settings.Keys) {
            [Environment]::SetEnvironmentVariable($name, $previous[$name], "Process")
        }
        [Environment]::SetEnvironmentVariable("npm_config_registry", $previousRegistry, "Process")
    }
}

function Get-WingetPath {
    return Find-Executable -Names @("winget.exe", "winget")
}

function Install-NodeRuntime {
    $winget = Get-WingetPath
    if ($winget) {
        try {
            Invoke-LoggedCommand -FilePath $winget -Arguments @(
                "install", "--id", "OpenJS.NodeJS.LTS", "-e", "--silent",
                "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"
            )
            Refresh-ProcessPath
            if (Get-NpmPath) { return }
        } catch {
            Write-WorkerLog "WinGet 安装 Node.js 失败，改用 Node.js 官方安装包：$($_.Exception.Message)"
        }
    }

    $releaseBase = "https://nodejs.org/download/release/latest-v22.x"
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("what-node-" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    try {
        $checksumsPath = Join-Path $tempDir "SHASUMS256.txt"
        Invoke-WebRequest -Uri "$releaseBase/SHASUMS256.txt" -OutFile $checksumsPath -UseBasicParsing
        $checksumLine = Get-Content -LiteralPath $checksumsPath | Where-Object { $_ -match ' node-v22[^ ]*-x64\.msi$' } | Select-Object -First 1
        if (-not $checksumLine -or $checksumLine -notmatch '^([A-Fa-f0-9]{64})\s+(.+)$') {
            throw "无法从 Node.js 官方校验文件中识别 Windows x64 安装包"
        }
        $expectedHash = $Matches[1].ToUpperInvariant()
        $fileName = $Matches[2].Trim()
        $installerPath = Join-Path $tempDir $fileName
        Write-WorkerLog "正在从 Node.js 官方站点下载 $fileName"
        Invoke-WebRequest -Uri "$releaseBase/$fileName" -OutFile $installerPath -UseBasicParsing
        $actualHash = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash.ToUpperInvariant()
        if ($actualHash -ne $expectedHash) { throw "Node.js 安装包 SHA-256 校验失败" }
        Write-WorkerLog "Node.js 安装包校验通过"
        $process = Start-Process -FilePath "msiexec.exe" -ArgumentList @("/i", "`"$installerPath`"", "/qn", "/norestart") -Verb RunAs -Wait -PassThru
        if ($process.ExitCode -notin @(0, 3010)) { throw "Node.js 安装程序退出代码：$($process.ExitCode)" }
    } finally {
        if (Test-Path -LiteralPath $tempDir) { Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
    }
    Refresh-ProcessPath
    $node = Find-Executable -Names @("node.exe", "node") -Candidates @("$env:ProgramFiles\nodejs\node.exe")
    $version = Get-CommandVersion -Path $node
    if (-not $version -or $version -notmatch '^v?(\d+)' -or [int]$Matches[1] -lt 22 -or -not (Get-NpmPath)) {
        throw "Node.js 安装完成，但没有检测到可用的 Node.js 22/npm；请重新打开安装器后重试"
    }
}

function Install-MpvPlayer {
    $winget = Get-WingetPath
    if (-not $winget) {
        throw "未找到可用的 WinGet。请先从 Microsoft Store 安装或修复应用安装程序，然后重试 mpv。"
    }
    Invoke-LoggedCommand -FilePath $winget -Arguments @(
        "install", "--id", "shinchiro.mpv", "-e", "--silent",
        "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"
    )
    Refresh-ProcessPath
    $mpv = Find-Executable -Names @("mpv.com", "mpv.exe", "mpv") -Candidates @(
        "$env:ProgramFiles\MPV Player\mpv.com",
        "$env:ProgramFiles\MPV Player\mpv.exe",
        "$env:ProgramFiles\mpv\mpv.com",
        "$env:ProgramFiles\mpv\mpv.exe"
    )
    if (-not $mpv) { throw "WinGet 已结束，但没有检测到 mpv 可执行文件" }
}

function Install-GitClient {
    $winget = Get-WingetPath
    if (-not $winget) {
        throw "未找到可用的 WinGet。请先从 Microsoft Store 安装或修复应用安装程序，然后重试 Git。"
    }
    Invoke-LoggedCommand -FilePath $winget -Arguments @(
        "install", "--id", "Git.Git", "-e", "--silent",
        "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"
    )
    Refresh-ProcessPath
    $git = Find-Executable -Names @("git.exe", "git") -Candidates @(
        "$env:ProgramFiles\Git\cmd\git.exe",
        "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
        "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
    )
    if (-not $git) { throw "WinGet 已结束，但没有检测到 Git 可执行文件" }
}

function Install-NcmCli {
    $npm = Get-NpmPath
    if (-not $npm) { throw "安装 ncm-cli 前需要先安装 Node.js/npm" }
    Invoke-NpmInstallWithRetry -NpmPath $npm -Description "安装 ncm-cli" -Arguments @(
        "install", "-g", "@music163/ncm-cli", "--no-fund", "--no-audit"
    )
    Refresh-ProcessPath
    $ncm = Find-Executable -Names @("ncm-cli.cmd", "ncm-cli") -Candidates @("$env:APPDATA\npm\ncm-cli.cmd")
    if (-not $ncm) { throw "npm 安装已结束，但没有检测到 ncm-cli" }
}

function Install-ProjectDependencies {
    $npm = Get-NpmPath
    if (-not $npm) { throw "安装项目依赖前需要先安装 Node.js/npm" }
    Push-Location $ProjectRoot
    try {
        Invoke-NpmInstallWithRetry -NpmPath $npm -Description "安装项目依赖" -Arguments @(
            "install", "--no-fund", "--no-audit"
        )
    } finally {
        Pop-Location
    }
    $state = Get-EnvironmentState
    if (-not $state.Dependencies.Installed) { throw "npm install 已结束，但部分项目依赖目录仍然缺失" }
}

function Set-EnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Key,
        [AllowEmptyString()][string]$Value,
        [switch]$PreserveExisting
    )
    $lines = if (Test-Path -LiteralPath $Path) { @(Get-Content -LiteralPath $Path -Encoding UTF8) } else { @() }
    $escapedKey = [Regex]::Escape($Key)
    $found = $false
    $updated = @(foreach ($line in $lines) {
        if ($line -match "^$escapedKey=") {
            $found = $true
            if ($PreserveExisting) { $line } else { "$Key=$Value" }
        } else { $line }
    })
    if (-not $found) { $updated += "$Key=$Value" }
    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Set-Content -LiteralPath $Path -Value $updated -Encoding UTF8
}

function Initialize-EnvironmentFiles {
    Refresh-ProcessPath
    $ncmPath = Find-Executable -Names @("ncm-cli.cmd", "ncm-cli") -Candidates @(
        "$env:APPDATA\npm\ncm-cli.cmd",
        (Join-Path $ProjectRoot "Music\node_modules\.bin\ncm-cli.cmd")
    )
    if (-not $ncmPath) { $ncmPath = "$env:APPDATA\npm\ncm-cli.cmd" }

    $musicEnv = Join-Path $ProjectRoot "Music\server\.env"
    $workbenchEnv = Join-Path $ProjectRoot "workbench\server\.env"

    Set-EnvValue -Path $musicEnv -Key "PORT" -Value "3001" -PreserveExisting
    Set-EnvValue -Path $musicEnv -Key "NCM_CLI_PATH" -Value $ncmPath
    Set-EnvValue -Path $musicEnv -Key "THEME_IMAGES_DIR" -Value "../client/public/images" -PreserveExisting
    Set-EnvValue -Path $musicEnv -Key "CORS_ORIGIN" -Value "http://localhost:5173" -PreserveExisting
    Set-EnvValue -Path $musicEnv -Key "ANTHROPIC_AUTH_TOKEN" -Value "" -PreserveExisting
    Set-EnvValue -Path $musicEnv -Key "ANTHROPIC_BASE_URL" -Value "https://api.deepseek.com/anthropic" -PreserveExisting
    Set-EnvValue -Path $musicEnv -Key "ANTHROPIC_MODEL" -Value "deepseek-v4-pro" -PreserveExisting
    Set-EnvValue -Path $musicEnv -Key "QQ_MUSIC_COOKIE" -Value "" -PreserveExisting

    Set-EnvValue -Path $workbenchEnv -Key "PORT" -Value "3000" -PreserveExisting
    Set-EnvValue -Path $workbenchEnv -Key "CORS_ORIGIN" -Value "http://localhost:5174" -PreserveExisting
    Set-EnvValue -Path $workbenchEnv -Key "MUSIC_API_URL" -Value "http://localhost:3001" -PreserveExisting
    Set-EnvValue -Path $workbenchEnv -Key "ANTHROPIC_AUTH_TOKEN" -Value "" -PreserveExisting
    Set-EnvValue -Path $workbenchEnv -Key "ANTHROPIC_BASE_URL" -Value "https://api.deepseek.com/anthropic" -PreserveExisting
    Set-EnvValue -Path $workbenchEnv -Key "ANTHROPIC_MODEL" -Value "deepseek-v4-pro" -PreserveExisting

    Write-WorkerLog "环境文件已就绪。DeepSeek API Key 留空时，基础功能可启动，但 AI 功能不可用。"
}

function Invoke-SetupWorker {
    if (-not $StatusFile -or -not $LogFile) { throw "Worker 模式缺少状态文件或日志文件路径" }
    New-Item -ItemType File -Path $StatusFile -Force | Out-Null
    New-Item -ItemType File -Path $LogFile -Force | Out-Null

    $requested = @($Items -split ',' | Where-Object { $_ })
    $order = @("Node", "Git", "Mpv", "Ncm", "Dependencies", "Environment")
    $queue = @($order | Where-Object { $requested -contains $_ })
    $failures = New-Object System.Collections.Generic.List[string]

    for ($index = 0; $index -lt $queue.Count; $index++) {
        $item = $queue[$index]
        $startProgress = [int](($index / [Math]::Max(1, $queue.Count)) * 100)
        $endProgress = [int]((($index + 1) / [Math]::Max(1, $queue.Count)) * 100)
        Write-WorkerStatus -Item $item -State "Running" -Message "正在处理" -Progress $startProgress
        try {
            $state = Get-EnvironmentState
            if ($state[$item].Installed) {
                Write-WorkerLog "$item 已存在，自动跳过。"
                Write-WorkerStatus -Item $item -State "Skipped" -Message "已安装，自动跳过" -Progress $endProgress
                continue
            }
            switch ($item) {
                "Node" { Install-NodeRuntime }
                "Git" { Install-GitClient }
                "Mpv" { Install-MpvPlayer }
                "Ncm" { Install-NcmCli }
                "Dependencies" { Install-ProjectDependencies }
                "Environment" { Initialize-EnvironmentFiles }
            }
            Write-WorkerStatus -Item $item -State "Success" -Message "处理完成" -Progress $endProgress
        } catch {
            $message = $_.Exception.Message
            $failures.Add("${item}: $message")
            Write-WorkerLog "[$item] 失败：$message"
            Write-WorkerStatus -Item $item -State "Failed" -Message $message -Progress $endProgress
        }
    }

    if ($failures.Count -gt 0) {
        Write-WorkerStatus -Item "All" -State "CompletedWithErrors" -Message ($failures -join "；") -Progress 100
        exit 1
    }
    Write-WorkerStatus -Item "All" -State "Completed" -Message "全部选中项目已完成" -Progress 100
}

if ($Worker) {
    Invoke-SetupWorker
    exit 0
}

if ($CheckOnly) {
    Get-EnvironmentState | ConvertTo-Json -Depth 5
    exit 0
}

# Only perform a pre-window scan when the user has explicitly chosen to skip
# the installer. Any missing requirement overrides the preference and restores
# the graphical checker.
if (-not $ForceShow -and (Get-SkipInstallerPreference)) {
    $skipState = Get-EnvironmentState
    if (Test-AllSetupReady -State $skipState) {
        Start-ProjectProcess
        exit 0
    }
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class WhatConsoleWindow {
    [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
[System.Windows.Forms.Application]::EnableVisualStyles()

$colors = @{
    Window = [Drawing.Color]::FromArgb(246, 248, 251)
    Surface = [Drawing.Color]::White
    Text = [Drawing.Color]::FromArgb(28, 36, 48)
    Muted = [Drawing.Color]::FromArgb(103, 117, 134)
    Border = [Drawing.Color]::FromArgb(222, 228, 236)
    Primary = [Drawing.Color]::FromArgb(99, 102, 241)
    Success = [Drawing.Color]::FromArgb(25, 115, 69)
    Warning = [Drawing.Color]::FromArgb(150, 86, 8)
    Error = [Drawing.Color]::FromArgb(190, 45, 45)
}

$form = New-Object Windows.Forms.Form
$form.Text = "工具栈 · 本地环境安装器"
$form.Size = New-Object Drawing.Size(760, 800)
$form.MinimumSize = New-Object Drawing.Size(680, 760)
$form.StartPosition = "CenterScreen"
$form.BackColor = $colors.Window
$form.Font = New-Object Drawing.Font("Microsoft YaHei UI", 9)

$title = New-Object Windows.Forms.Label
$title.Text = "选择需要安装的组件"
$title.Font = New-Object Drawing.Font("Microsoft YaHei UI", 16, [Drawing.FontStyle]::Bold)
$title.ForeColor = $colors.Text
$title.AutoSize = $true
$title.Location = New-Object Drawing.Point(24, 22)
$form.Controls.Add($title)

$subtitle = New-Object Windows.Forms.Label
$subtitle.Text = "已安装的组件会自动跳过；可单选、多选，或一键处理全部缺失项。"
$subtitle.ForeColor = $colors.Muted
$subtitle.AutoSize = $true
$subtitle.Location = New-Object Drawing.Point(27, 57)
$form.Controls.Add($subtitle)

$selectionLabel = New-Object Windows.Forms.Label
$selectionLabel.ForeColor = $colors.Muted
$selectionLabel.AutoSize = $true
$selectionLabel.Location = New-Object Drawing.Point(27, 91)
$form.Controls.Add($selectionLabel)

$selectMissingButton = New-Object Windows.Forms.Button
$selectMissingButton.Text = "选择全部缺失项"
$selectMissingButton.Enabled = $false
$selectMissingButton.FlatStyle = "Flat"
$selectMissingButton.FlatAppearance.BorderSize = 0
$selectMissingButton.ForeColor = $colors.Primary
$selectMissingButton.BackColor = $colors.Window
$selectMissingButton.Size = New-Object Drawing.Size(130, 30)
$selectMissingButton.Anchor = "Top,Right"
$selectMissingButton.Location = New-Object Drawing.Point(596, 81)
$form.Controls.Add($selectMissingButton)

$itemsPanel = New-Object Windows.Forms.Panel
$itemsPanel.Location = New-Object Drawing.Point(24, 120)
$itemsPanel.Size = New-Object Drawing.Size(704, 330)
$itemsPanel.Anchor = "Top,Left,Right"
$itemsPanel.BackColor = $colors.Surface
$itemsPanel.BorderStyle = "FixedSingle"
$form.Controls.Add($itemsPanel)

$definitions = [ordered]@{
    Node = @{ Name = "Node.js 22 LTS"; Description = "项目运行时与 npm 包管理器"; Icon = "N"; Optional = $false }
    Git = @{ Name = "Git for Windows（可选）"; Description = "版本管理、提交代码并上传 GitHub"; Icon = "G"; Optional = $true }
    Mpv = @{ Name = "mpv 播放器"; Description = "Music 模块的本地音频播放引擎"; Icon = "▶"; Optional = $false }
    Ncm = @{ Name = "ncm-cli"; Description = "网易云音乐命令行与登录能力"; Icon = "♫"; Optional = $false }
    Dependencies = @{ Name = "项目依赖"; Description = "Electron、Music、Workbench、Tools 与 Fitness"; Icon = "▣"; Optional = $false }
    Environment = @{ Name = "环境配置"; Description = "创建 .env，并配置本机 ncm-cli 路径"; Icon = "⚙"; Optional = $false }
}
$rows = @{}

$rowIndex = 0
foreach ($key in $definitions.Keys) {
    $definition = $definitions[$key]
    $row = New-Object Windows.Forms.Panel
    $row.Location = New-Object Drawing.Point(0, ($rowIndex * 55))
    $row.Size = New-Object Drawing.Size(702, 55)
    $row.Anchor = "Top,Left,Right"
    $row.BackColor = $colors.Surface
    $itemsPanel.Controls.Add($row)

    $check = New-Object Windows.Forms.CheckBox
    $check.Location = New-Object Drawing.Point(16, 17)
    $check.Size = New-Object Drawing.Size(20, 22)
    $row.Controls.Add($check)

    $icon = New-Object Windows.Forms.Label
    $icon.Text = $definition.Icon
    $icon.TextAlign = "MiddleCenter"
    $icon.Font = New-Object Drawing.Font("Segoe UI Symbol", 13, [Drawing.FontStyle]::Bold)
    $icon.ForeColor = $colors.Primary
    $icon.BackColor = [Drawing.Color]::FromArgb(239, 240, 255)
    $icon.Location = New-Object Drawing.Point(47, 8)
    $icon.Size = New-Object Drawing.Size(38, 38)
    $row.Controls.Add($icon)

    $name = New-Object Windows.Forms.Label
    $name.Text = $definition.Name
    $name.Font = New-Object Drawing.Font("Microsoft YaHei UI", 9, [Drawing.FontStyle]::Bold)
    $name.ForeColor = $colors.Text
    $name.AutoSize = $true
    $name.Location = New-Object Drawing.Point(99, 8)
    $row.Controls.Add($name)

    $description = New-Object Windows.Forms.Label
    $description.Text = $definition.Description
    $description.ForeColor = $colors.Muted
    $description.AutoSize = $true
    $description.Location = New-Object Drawing.Point(99, 31)
    $row.Controls.Add($description)

    $status = New-Object Windows.Forms.Label
    $status.TextAlign = "MiddleRight"
    $status.Text = "等待检测"
    $status.ForeColor = $colors.Warning
    $status.Location = New-Object Drawing.Point(510, 13)
    $status.Size = New-Object Drawing.Size(170, 28)
    $status.Anchor = "Top,Right"
    $row.Controls.Add($status)

    if ($rowIndex -lt ($definitions.Count - 1)) {
        $line = New-Object Windows.Forms.Panel
        $line.BackColor = $colors.Border
        $line.Location = New-Object Drawing.Point(15, 54)
        $line.Size = New-Object Drawing.Size(670, 1)
        $line.Anchor = "Left,Right,Bottom"
        $row.Controls.Add($line)
    }

    $rows[$key] = @{ Panel = $row; Check = $check; Status = $status; Name = $name; Description = $description }
    $rowIndex++
}

$apiPanel = New-Object Windows.Forms.Panel
$apiPanel.Location = New-Object Drawing.Point(24, 463)
$apiPanel.Size = New-Object Drawing.Size(704, 82)
$apiPanel.Anchor = "Top,Left,Right"
$apiPanel.BackColor = $colors.Surface
$apiPanel.BorderStyle = "FixedSingle"
$form.Controls.Add($apiPanel)

$apiLabel = New-Object Windows.Forms.Label
$apiLabel.Text = "DeepSeek API Key"
$apiLabel.Font = New-Object Drawing.Font("Microsoft YaHei UI", 9, [Drawing.FontStyle]::Bold)
$apiLabel.ForeColor = $colors.Text
$apiLabel.AutoSize = $true
$apiLabel.Location = New-Object Drawing.Point(15, 13)
$apiPanel.Controls.Add($apiLabel)

$apiDescription = New-Object Windows.Forms.Label
$apiDescription.Text = "用于 Workbench、Music AI 分析和 Tools 日记 AI；输入内容不会写入日志。"
$apiDescription.ForeColor = $colors.Muted
$apiDescription.AutoSize = $true
$apiDescription.Location = New-Object Drawing.Point(15, 42)
$apiPanel.Controls.Add($apiDescription)

$apiKeyBox = New-Object Windows.Forms.TextBox
$apiKeyBox.UseSystemPasswordChar = $true
$apiKeyBox.Location = New-Object Drawing.Point(345, 13)
$apiKeyBox.Size = New-Object Drawing.Size(220, 25)
$apiKeyBox.Anchor = "Top,Right"
$apiPanel.Controls.Add($apiKeyBox)

$apiStatus = New-Object Windows.Forms.Label
$apiStatus.TextAlign = "MiddleRight"
$apiStatus.Location = New-Object Drawing.Point(477, 43)
$apiStatus.Size = New-Object Drawing.Size(88, 24)
$apiStatus.Anchor = "Top,Right"
$apiPanel.Controls.Add($apiStatus)

$getApiKeyButton = New-Object Windows.Forms.Button
$getApiKeyButton.Text = "申请密钥"
$getApiKeyButton.Size = New-Object Drawing.Size(95, 28)
$getApiKeyButton.Location = New-Object Drawing.Point(579, 42)
$getApiKeyButton.Anchor = "Top,Right"
$apiPanel.Controls.Add($getApiKeyButton)

$saveApiKeyButton = New-Object Windows.Forms.Button
$saveApiKeyButton.Text = "保存密钥"
$saveApiKeyButton.FlatStyle = "Flat"
$saveApiKeyButton.FlatAppearance.BorderSize = 0
$saveApiKeyButton.BackColor = $colors.Primary
$saveApiKeyButton.ForeColor = [Drawing.Color]::White
$saveApiKeyButton.Size = New-Object Drawing.Size(95, 28)
$saveApiKeyButton.Location = New-Object Drawing.Point(579, 10)
$saveApiKeyButton.Anchor = "Top,Right"
$apiPanel.Controls.Add($saveApiKeyButton)

$progressTitle = New-Object Windows.Forms.Label
$progressTitle.Text = "等待开始"
$progressTitle.ForeColor = $colors.Text
$progressTitle.AutoSize = $true
$progressTitle.Location = New-Object Drawing.Point(27, 564)
$form.Controls.Add($progressTitle)

$progressValue = New-Object Windows.Forms.Label
$progressValue.Text = "0%"
$progressValue.TextAlign = "MiddleRight"
$progressValue.ForeColor = $colors.Muted
$progressValue.Size = New-Object Drawing.Size(55, 20)
$progressValue.Anchor = "Top,Right"
$progressValue.Location = New-Object Drawing.Point(671, 560)
$form.Controls.Add($progressValue)

$progressBar = New-Object Windows.Forms.ProgressBar
$progressBar.Style = "Continuous"
$progressBar.Minimum = 0
$progressBar.Maximum = 100
$progressBar.Value = 0
$progressBar.Location = New-Object Drawing.Point(27, 592)
$progressBar.Size = New-Object Drawing.Size(699, 10)
$progressBar.Anchor = "Top,Left,Right"
$form.Controls.Add($progressBar)

$logBox = New-Object Windows.Forms.TextBox
$logBox.Multiline = $true
$logBox.ReadOnly = $true
$logBox.ScrollBars = "Vertical"
$logBox.BackColor = [Drawing.Color]::FromArgb(241, 244, 248)
$logBox.ForeColor = $colors.Muted
$logBox.BorderStyle = "FixedSingle"
$logBox.Location = New-Object Drawing.Point(27, 614)
$logBox.Size = New-Object Drawing.Size(699, 90)
$logBox.Anchor = "Top,Bottom,Left,Right"
$logBox.Text = "安装过程和失败原因会显示在这里。"
$form.Controls.Add($logBox)

$refreshButton = New-Object Windows.Forms.Button
$refreshButton.Text = "重新检测"
$refreshButton.Enabled = $false
$refreshButton.Size = New-Object Drawing.Size(100, 36)
$refreshButton.Anchor = "Bottom,Left"
$refreshButton.Location = New-Object Drawing.Point(24, 710)
$form.Controls.Add($refreshButton)

$skipInstallerButton = New-Object Windows.Forms.Button
$skipInstallerButton.Text = "以后直接启动"
$skipInstallerButton.Visible = $false
$skipInstallerButton.Enabled = $false
$skipInstallerButton.Size = New-Object Drawing.Size(125, 36)
$skipInstallerButton.Anchor = "Bottom,Left"
$skipInstallerButton.Location = New-Object Drawing.Point(135, 710)
$form.Controls.Add($skipInstallerButton)

$autoCloseCheck = New-Object Windows.Forms.CheckBox
$autoCloseCheck.Text = "启动后自动关闭"
$autoCloseCheck.Checked = Get-AutoClosePreference
$autoCloseCheck.ForeColor = $colors.Muted
$autoCloseCheck.AutoSize = $true
$autoCloseCheck.Anchor = "Bottom,Left"
$autoCloseCheck.Location = New-Object Drawing.Point(273, 720)
$form.Controls.Add($autoCloseCheck)

$installSelectedButton = New-Object Windows.Forms.Button
$installSelectedButton.Text = "仅安装选择项"
$installSelectedButton.Enabled = $false
$installSelectedButton.Size = New-Object Drawing.Size(135, 36)
$installSelectedButton.Anchor = "Bottom,Right"
$installSelectedButton.Location = New-Object Drawing.Point(442, 710)
$form.Controls.Add($installSelectedButton)

$installAllButton = New-Object Windows.Forms.Button
$installAllButton.Text = "一键安装全部并启动"
$installAllButton.Enabled = $false
$installAllButton.FlatStyle = "Flat"
$installAllButton.FlatAppearance.BorderSize = 0
$installAllButton.BackColor = $colors.Primary
$installAllButton.ForeColor = [Drawing.Color]::White
$installAllButton.Size = New-Object Drawing.Size(150, 36)
$installAllButton.Anchor = "Bottom,Right"
$installAllButton.Location = New-Object Drawing.Point(584, 710)
$form.Controls.Add($installAllButton)

$script:currentState = $null
$script:workerProcess = $null
$script:statusPath = $null
$script:logPath = $null
$script:statusLineCount = 0
$script:lastLogLength = 0
$script:startAfterInstall = $false
$script:failedItems = New-Object 'System.Collections.Generic.HashSet[string]'
$script:workerStartedAt = $null
$script:activeItemName = $null
$script:receivedFinalStatus = $false
$script:requestedItems = @()
$script:userCancelled = $false
$script:isScanning = $false

function Update-SelectionLabel {
    $selected = @($rows.Keys | Where-Object { $rows[$_].Check.Checked }).Count
    $missing = if ($script:currentState) { @($rows.Keys | Where-Object { -not $script:currentState[$_].Installed }).Count } else { 0 }
    $selectionLabel.Text = "已选择 $selected 项，共 $missing 项缺失"
    $installSelectedButton.Enabled = ($selected -gt 0) -and (-not $script:workerProcess) -and (-not $script:isScanning)
}

function Start-EnvironmentScan {
    if ($script:isScanning -or $script:workerProcess) { return }
    $script:isScanning = $true
    $refreshButton.Text = "检测中…"
    $refreshButton.Enabled = $false
    $selectMissingButton.Enabled = $false
    $installSelectedButton.Enabled = $false
    $installAllButton.Enabled = $false
    $skipInstallerButton.Enabled = $false
    $progressTitle.Text = "正在检测本机环境…"
    $progressValue.Text = "检测中"
    $progressBar.Style = "Marquee"
    $progressBar.MarqueeAnimationSpeed = 24
    foreach ($key in $rows.Keys) {
        $rows[$key].Status.Text = "检测中…"
        $rows[$key].Status.ForeColor = $colors.Primary
    }
    $timestamp = Get-Date -Format "HH:mm:ss"
    $logBox.AppendText("`r`n[$timestamp] 正在重新检测 Node.js、Git、mpv、ncm-cli、项目依赖和环境配置…")
    $logBox.SelectionStart = $logBox.TextLength
    $logBox.ScrollToCaret()
    $form.Refresh()
    $environmentScanTimer.Start()
}

function Update-UiState {
    $hadPreviousState = $null -ne $script:currentState
    $script:currentState = Get-EnvironmentState
    foreach ($key in $rows.Keys) {
        $entry = $script:currentState[$key]
        $row = $rows[$key]
        if ($entry.Installed) {
            $row.Check.Checked = $false
            $row.Check.Enabled = $false
            $row.Status.Text = "✓ $($entry.Version)"
            $row.Status.ForeColor = $colors.Success
            $row.Panel.BackColor = [Drawing.Color]::FromArgb(250, 251, 252)
        } else {
            $row.Check.Enabled = $true
            if (-not $definitions[$key].Optional) {
                $row.Check.Checked = $true
            } elseif (-not $hadPreviousState) {
                $row.Check.Checked = $false
            }
            $row.Status.Text = if ($key -eq "Environment") { "待配置" } else { $entry.Version }
            $row.Status.ForeColor = $colors.Warning
            $row.Panel.BackColor = $colors.Surface
        }
    }
    if ($script:currentState.ApiKey.Installed) {
        $apiStatus.Text = "✓ 已配置"
        $apiStatus.ForeColor = $colors.Success
    } else {
        $apiStatus.Text = "未配置"
        $apiStatus.ForeColor = $colors.Warning
    }
    $requiredKeys = @($rows.Keys | Where-Object { -not $definitions[$_].Optional })
    $allReady = @($requiredKeys | Where-Object { -not $script:currentState[$_].Installed }).Count -eq 0
    $fullyReady = Test-AllSetupReady -State $script:currentState
    $installAllButton.Text = if ($allReady) { "启动项目" } else { "一键安装全部并启动" }
    $installAllButton.Enabled = $true
    $selectMissingButton.Enabled = $true
    $skipInstallerButton.Visible = $fullyReady
    $preferenceEnabled = $fullyReady -and (Get-SkipInstallerPreference)
    $skipInstallerButton.Text = if ($preferenceEnabled) { "✓ 下次直接启动" } else { "以后直接启动" }
    $skipInstallerButton.Enabled = $fullyReady -and (-not $preferenceEnabled)
    Update-SelectionLabel
}

function Set-UiBusy {
    param([bool]$Busy)
    $refreshButton.Enabled = -not $Busy
    $selectMissingButton.Enabled = -not $Busy
    $installAllButton.Enabled = -not $Busy
    $apiKeyBox.Enabled = -not $Busy
    $saveApiKeyButton.Enabled = -not $Busy
    $getApiKeyButton.Enabled = -not $Busy
    $skipInstallerButton.Enabled = (-not $Busy) -and (Test-AllSetupReady -State $script:currentState)
    foreach ($key in $rows.Keys) {
        if (-not $script:currentState[$key].Installed) { $rows[$key].Check.Enabled = -not $Busy }
    }
    if ($Busy) {
        $installSelectedButton.Text = "取消安装"
        $installSelectedButton.Enabled = $true
    } else {
        $installSelectedButton.Text = "仅安装选择项"
        Update-SelectionLabel
    }
}

function Stop-WorkerProcess {
    if (-not $script:workerProcess -or $script:workerProcess.HasExited) { return }
    $script:userCancelled = $true
    $progressTitle.Text = "正在取消安装…"
    try {
        $taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
        $cancelProcess = Start-Process -FilePath $taskkill -ArgumentList @(
            "/PID", $script:workerProcess.Id, "/T", "/F"
        ) -WindowStyle Hidden -Wait -PassThru
        if ($cancelProcess.ExitCode -ne 0 -and -not $script:workerProcess.HasExited) {
            throw "无法终止安装进程（退出代码 $($cancelProcess.ExitCode)）"
        }
    } catch {
        [Windows.Forms.MessageBox]::Show("取消安装失败：$($_.Exception.Message)", "无法取消", "OK", "Error") | Out-Null
        $script:userCancelled = $false
    }
}

function Save-ApiKey {
    param([switch]$Silent)
    $value = $apiKeyBox.Text.Trim()
    if ([string]::IsNullOrWhiteSpace($value)) {
        if (-not $Silent) {
            [Windows.Forms.MessageBox]::Show("请先输入 DeepSeek API Key。", "密钥为空", "OK", "Information") | Out-Null
        }
        return $false
    }
    if (-not (Test-ApiKeyValue $value)) {
        if (-not $Silent) {
            [Windows.Forms.MessageBox]::Show("API Key 格式不正确。请粘贴平台生成的英文字符密钥，不要填写【你的 API Key】等中文占位文字。", "密钥格式错误", "OK", "Warning") | Out-Null
        }
        return $false
    }
    try {
        Initialize-EnvironmentFiles
        Set-EnvValue -Path (Join-Path $ProjectRoot "Music\server\.env") -Key "ANTHROPIC_AUTH_TOKEN" -Value $value
        Set-EnvValue -Path (Join-Path $ProjectRoot "workbench\server\.env") -Key "ANTHROPIC_AUTH_TOKEN" -Value $value
        $apiKeyBox.Clear()
        Update-UiState
        $apiStatus.Text = "✓ 已保存"
        $apiStatus.ForeColor = $colors.Success
        if (-not $Silent) {
            [Windows.Forms.MessageBox]::Show("DeepSeek API Key 已安全写入 Music 和 workbench 的本地 .env 文件。", "保存成功", "OK", "Information") | Out-Null
        }
        return $true
    } catch {
        [Windows.Forms.MessageBox]::Show("密钥保存失败：$($_.Exception.Message)", "保存失败", "OK", "Error") | Out-Null
        return $false
    }
}

function Start-Project {
    $npm = Get-NpmPath
    if (-not $npm) {
        [Windows.Forms.MessageBox]::Show("未找到 npm，请先完成 Node.js 安装。", "无法启动", "OK", "Error") | Out-Null
        return
    }
    $state = Get-EnvironmentState
    if (-not $state.Dependencies.Installed) {
        [Windows.Forms.MessageBox]::Show(
            "检测到项目依赖不完整或代码更新后尚未同步。请先安装[项目依赖]。`r`n`r`n$($state.Dependencies.Detail)",
            "项目依赖需要更新", "OK", "Warning"
        ) | Out-Null
        Update-UiState
        return
    }
    if (-not $state.ApiKey.Installed) {
        $answer = [Windows.Forms.MessageBox]::Show(
            "DeepSeek API Key 尚未配置。项目仍可启动，但 Workbench、Music AI 分析和 Tools 日记 AI 将不可用。是否继续启动？",
            "AI 功能未配置", "YesNo", "Warning"
        )
        if ($answer -ne "Yes") { return }
    }
    Start-ProjectProcess
    $progressTitle.Text = "项目正在启动"
    $logBox.AppendText("`r`n已启动后台服务，Electron 窗口将在服务就绪后打开。")
    if ($autoCloseCheck.Checked) {
        $autoCloseTimer.Start()
    }
}

function Start-Install {
    param([bool]$AllMissing, [bool]$StartAfter)
    $requestedBeforeSave = @($rows.Keys | Where-Object { $rows[$_].Check.Checked })
    if (-not [string]::IsNullOrWhiteSpace($apiKeyBox.Text)) {
        if (-not (Save-ApiKey -Silent)) { return }
    }
    if ($AllMissing) {
        foreach ($key in $rows.Keys) {
            if (-not $script:currentState[$key].Installed) { $rows[$key].Check.Checked = $true }
        }
    } else {
        foreach ($key in $rows.Keys) {
            $rows[$key].Check.Checked = ($requestedBeforeSave -contains $key) -and (-not $script:currentState[$key].Installed)
        }
    }
    $selected = @($rows.Keys | Where-Object { $rows[$_].Check.Checked })
    if ($selected.Count -eq 0) {
        if ($StartAfter) { Start-Project }
        return
    }

    $needsNode = ($selected -contains "Ncm" -or $selected -contains "Dependencies") -and (-not $script:currentState.Node.Installed)
    if ($needsNode -and -not ($selected -contains "Node")) {
        $answer = [Windows.Forms.MessageBox]::Show(
            "ncm-cli 和项目依赖需要 Node.js。是否将 Node.js 自动加入本次安装？",
            "补充必要依赖", "YesNo", "Question"
        )
        if ($answer -ne "Yes") { return }
        $rows.Node.Check.Checked = $true
        $selected = @("Node") + $selected
    }

    $confirmText = "即将处理：`r`n`r`n" + (($selected | ForEach-Object { "• $($definitions[$_].Name)" }) -join "`r`n")
    if ($selected -contains "Node" -or $selected -contains "Git" -or $selected -contains "Mpv") {
        $confirmText += "`r`n`r`n系统软件安装过程中可能出现 Windows 权限确认窗口。"
    }
    if ([Windows.Forms.MessageBox]::Show($confirmText, "确认安装", "OKCancel", "Information") -ne "OK") { return }

    $sessionDir = Join-Path ([System.IO.Path]::GetTempPath()) ("what-setup-" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $sessionDir -Force | Out-Null
    $script:statusPath = Join-Path $sessionDir "status.jsonl"
    $script:logPath = Join-Path $sessionDir "install.log"
    $script:statusLineCount = 0
    $script:lastLogLength = 0
    $script:startAfterInstall = $StartAfter
    $script:failedItems.Clear()
    $script:workerStartedAt = Get-Date
    $script:activeItemName = $null
    $script:receivedFinalStatus = $false
    $script:requestedItems = @($selected)
    $script:userCancelled = $false
    $progressBar.Value = 0
    $progressValue.Text = "0%"
    $progressTitle.Text = "准备安装"
    $logBox.Clear()
    Set-UiBusy -Busy $true

    $powershell = (Get-Process -Id $PID).Path
    $argumentList = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath,
        "-Worker", "-Items", ($selected -join ','), "-ProjectRoot", $ProjectRoot,
        "-StatusFile", $script:statusPath, "-LogFile", $script:logPath
    )
    $script:workerProcess = Start-Process -FilePath $powershell -ArgumentList $argumentList -WindowStyle Hidden -PassThru
    $pollTimer.Start()
}

$pollTimer = New-Object Windows.Forms.Timer
$pollTimer.Interval = 350
$pollTimer.Add_Tick({
    if ($script:logPath -and (Test-Path -LiteralPath $script:logPath)) {
        try {
            $logContent = Get-Content -LiteralPath $script:logPath -Encoding UTF8 -Raw -ErrorAction SilentlyContinue
            if ($logContent -and $logContent.Length -ne $script:lastLogLength) {
                $logBox.Text = $logContent
                $logBox.SelectionStart = $logBox.TextLength
                $logBox.ScrollToCaret()
                $script:lastLogLength = $logContent.Length
            }
        } catch { }
    }

    if ($script:statusPath -and (Test-Path -LiteralPath $script:statusPath)) {
        $lines = @(Get-Content -LiteralPath $script:statusPath -Encoding UTF8 -ErrorAction SilentlyContinue)
        if ($lines.Count -gt $script:statusLineCount) {
            foreach ($line in $lines[$script:statusLineCount..($lines.Count - 1)]) {
                if ([string]::IsNullOrWhiteSpace($line)) { continue }
                try {
                    $event = $line | ConvertFrom-Json
                    $progressBar.Value = [Math]::Max(0, [Math]::Min(100, [int]$event.Progress))
                    $progressValue.Text = "$($progressBar.Value)%"
                    if ($event.Item -ne "All") {
                        $displayName = $definitions[$event.Item].Name
                        $progressTitle.Text = switch ($event.State) {
                            "Running" { "正在处理 $displayName" }
                            "Success" { "$displayName 已完成" }
                            "Skipped" { "$displayName 已跳过" }
                            "Failed" { "$displayName 安装失败" }
                            default { $event.Message }
                        }
                        if ($event.State -eq "Running") {
                            $script:activeItemName = $displayName
                            $rows[$event.Item].Status.Text = "正在处理…"
                            $rows[$event.Item].Status.ForeColor = $colors.Primary
                        } elseif ($event.State -eq "Failed") {
                            [void]$script:failedItems.Add([string]$event.Item)
                            $rows[$event.Item].Status.Text = "安装失败"
                            $rows[$event.Item].Status.ForeColor = $colors.Error
                        } elseif ($event.State -in @("Success", "Skipped")) {
                            $rows[$event.Item].Status.Text = "✓ 已完成"
                            $rows[$event.Item].Status.ForeColor = $colors.Success
                        }
                    } else {
                        $script:receivedFinalStatus = $true
                        $script:activeItemName = $null
                        $progressTitle.Text = if ($event.State -eq "Completed") { "全部处理完成" } else { "部分项目安装失败" }
                    }
                } catch { }
            }
            $script:statusLineCount = $lines.Count
        }
    }

    if ($script:workerProcess -and -not $script:workerProcess.HasExited -and $script:activeItemName -and $script:workerStartedAt) {
        $elapsed = (Get-Date) - $script:workerStartedAt
        $elapsedText = if ($elapsed.TotalHours -ge 1) {
            "{0:00}:{1:00}:{2:00}" -f [int]$elapsed.TotalHours, $elapsed.Minutes, $elapsed.Seconds
        } else {
            "{0:00}:{1:00}" -f [int]$elapsed.TotalMinutes, $elapsed.Seconds
        }
        $progressTitle.Text = "正在处理 $($script:activeItemName) · 已用时 $elapsedText"
    }

    if ($script:workerProcess -and $script:workerProcess.HasExited) {
        $pollTimer.Stop()
        $exitCode = $script:workerProcess.ExitCode
        $script:workerProcess.Dispose()
        $script:workerProcess = $null
        Set-UiBusy -Busy $false
        Update-UiState
        foreach ($failedItem in $script:failedItems) {
            $rows[$failedItem].Status.Text = "安装失败"
            $rows[$failedItem].Status.ForeColor = $colors.Error
        }
        $endedUnexpectedly = -not $script:receivedFinalStatus
        if ($script:userCancelled) {
            $progressTitle.Text = "安装已取消"
            $progressValue.Text = "已取消"
            $logBox.AppendText("`r`n`r`n本次安装已由用户取消；已经完成的内容会被保留。")
        } elseif ($exitCode -eq 0 -and -not $endedUnexpectedly) {
            $progressBar.Value = 100
            $progressValue.Text = "100%"
            $progressTitle.Text = "安装与配置已完成"
            if ($script:startAfterInstall) { Start-Project }
        } else {
            if ($endedUnexpectedly) {
                $progressTitle.Text = "安装进程意外结束"
                $logBox.AppendText("`r`n`r`n安装后台进程已结束，但未返回完成状态。请重新勾选缺失项重试。")
                [Windows.Forms.MessageBox]::Show("安装后台进程意外结束。已安装的内容会被保留；请重新勾选缺失项重试。", "安装已中断", "OK", "Warning") | Out-Null
            } else {
                [Windows.Forms.MessageBox]::Show("部分项目安装失败。请查看窗口中的日志，修复后可只勾选失败项重试。", "安装未完全成功", "OK", "Warning") | Out-Null
            }
        }
    }
})

$autoCloseTimer = New-Object Windows.Forms.Timer
$autoCloseTimer.Interval = 800
$autoCloseTimer.Add_Tick({
    $autoCloseTimer.Stop()
    $form.Close()
})

$environmentScanTimer = New-Object Windows.Forms.Timer
$environmentScanTimer.Interval = 80
$environmentScanTimer.Add_Tick({
    $environmentScanTimer.Stop()
    try {
        # The short timer delay lets Windows paint the marquee and disabled
        # controls before the synchronous environment probes begin.
        $script:isScanning = $false
        Update-UiState
        $progressBar.Style = "Continuous"
        $progressBar.Value = 100
        $progressValue.Text = "100%"
        $progressTitle.Text = "环境检测完成"
        $timestamp = Get-Date -Format "HH:mm:ss"
        $missing = @($rows.Keys | Where-Object { -not $script:currentState[$_].Installed }).Count
        $logBox.AppendText("`r`n[$timestamp] 环境检测完成：$missing 项尚未完成。")
    } catch {
        $script:isScanning = $false
        $progressBar.Style = "Continuous"
        $progressBar.Value = 0
        $progressValue.Text = "失败"
        $progressTitle.Text = "环境检测失败"
        $logBox.AppendText("`r`n环境检测失败：$($_.Exception.Message)")
        [Windows.Forms.MessageBox]::Show("环境检测失败：$($_.Exception.Message)", "检测失败", "OK", "Error") | Out-Null
    } finally {
        $refreshButton.Text = "重新检测"
        $refreshButton.Enabled = $true
        $logBox.SelectionStart = $logBox.TextLength
        $logBox.ScrollToCaret()
    }
})

$startupTimer = New-Object Windows.Forms.Timer
$startupTimer.Interval = 120
$startupTimer.Add_Tick({
    $startupTimer.Stop()
    Start-EnvironmentScan
})

foreach ($key in $rows.Keys) {
    $rows[$key].Check.Add_CheckedChanged({ Update-SelectionLabel })
}
$selectMissingButton.Add_Click({
    foreach ($key in $rows.Keys) {
        if (-not $script:currentState[$key].Installed) { $rows[$key].Check.Checked = $true }
    }
})
$refreshButton.Add_Click({
    Start-EnvironmentScan
})
$skipInstallerButton.Add_Click({
    if (-not (Test-AllSetupReady -State (Get-EnvironmentState))) {
        [Windows.Forms.MessageBox]::Show("当前环境已发生变化，仍有项目未完成，安装器将继续在启动时显示。", "环境尚未完成", "OK", "Warning") | Out-Null
        Update-UiState
        return
    }
    Set-SkipInstallerPreference -Enabled $true
    $skipInstallerButton.Text = "✓ 已设置"
    $skipInstallerButton.Enabled = $false
    [Windows.Forms.MessageBox]::Show(
        "设置成功。下次启动时，环境完整会直接打开项目；如果检测到任何缺失项，安装器仍会自动弹出。`r`n`r`n需要再次打开安装器时，可运行：`r`npowershell -File setup.ps1 -ForceShow",
        "以后直接启动", "OK", "Information"
    ) | Out-Null
})
$saveApiKeyButton.Add_Click({ [void](Save-ApiKey) })
$getApiKeyButton.Add_Click({ Start-Process "https://platform.deepseek.com/api_keys" })
$autoCloseCheck.Add_CheckedChanged({
    try {
        Set-AutoClosePreference -Enabled $autoCloseCheck.Checked
    } catch {
        [Windows.Forms.MessageBox]::Show("无法保存自动关闭设置：$($_.Exception.Message)", "设置保存失败", "OK", "Warning") | Out-Null
    }
})
$installSelectedButton.Add_Click({
    if ($script:workerProcess -and -not $script:workerProcess.HasExited) {
        if ([Windows.Forms.MessageBox]::Show("确定取消本次安装吗？已经安装完成的内容会被保留。", "取消安装", "YesNo", "Warning") -eq "Yes") {
            Stop-WorkerProcess
        }
    } else {
        Start-Install -AllMissing $false -StartAfter $false
    }
})
$installAllButton.Add_Click({
        $requiredKeys = @($rows.Keys | Where-Object { -not $definitions[$_].Optional })
        $allReady = @($requiredKeys | Where-Object { -not $script:currentState[$_].Installed }).Count -eq 0
    if ($allReady) { Start-Project } else { Start-Install -AllMissing $true -StartAfter $true }
})
$form.Add_FormClosing({
    if ($script:workerProcess -and -not $script:workerProcess.HasExited) {
        $answer = [Windows.Forms.MessageBox]::Show("安装仍在进行。关闭窗口将取消本次安装并终止其后台进程。确定关闭吗？", "安装进行中", "YesNo", "Warning")
        if ($answer -ne "Yes") {
            $_.Cancel = $true
        } else {
            Stop-WorkerProcess
        }
    }
})

if ($UiSmokeTest) {
    $environmentScanTimer.Add_Tick({ $form.Close() })
    $form.Add_Shown({
        $progressTitle.Text = "正在检测本机环境…"
        $progressValue.Text = "检测中"
        $startupTimer.Start()
    })
} else {
    $form.Add_Shown({
        [void][WhatConsoleWindow]::ShowWindow([WhatConsoleWindow]::GetConsoleWindow(), 0)
        $progressTitle.Text = "正在检测本机环境…"
        $progressValue.Text = "检测中"
        $startupTimer.Start()
    })
}
[void]$form.ShowDialog()










