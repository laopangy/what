' Windows launcher for the local setup UI. Keep this file ASCII without a BOM
' because Windows Script Host does not reliably parse UTF-8 VBScript files.
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
On Error Resume Next

ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = ScriptDir
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File """ & ScriptDir & "\setup.ps1""", 1, False

If Err.Number <> 0 Then
    MsgBox "Unable to open the local setup window." & vbCrLf & vbCrLf & Err.Description & vbCrLf & vbCrLf & "Please try start.bat instead.", vbCritical, "Startup failed"
End If
