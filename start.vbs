' 阿潘阿潘潘的工具栈 — 静默启动（不显示命令行窗口）
Set WshShell = CreateObject("Wscript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)

' Run start.bat hidden (window style 0 = hidden)
WshShell.CurrentDirectory = ScriptDir
WshShell.Run "cmd /c start.bat", 0, False
