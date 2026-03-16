; Performance and security update
!macro customInstall
  ; Hide common Electron/Chromium clutter in the installation root to achieve a cleaner look
  SetFileAttributes "$INSTDIR\chrome_100_percent.pak" HIDDEN
  SetFileAttributes "$INSTDIR\chrome_200_percent.pak" HIDDEN
  SetFileAttributes "$INSTDIR\d3dcompiler_47.dll" HIDDEN
  SetFileAttributes "$INSTDIR\ffmpeg.dll" HIDDEN
  SetFileAttributes "$INSTDIR\icudtl.dat" HIDDEN
  SetFileAttributes "$INSTDIR\libEGL.dll" HIDDEN
  SetFileAttributes "$INSTDIR\libGLESv2.dll" HIDDEN
  SetFileAttributes "$INSTDIR\LICENSE.electron.txt" HIDDEN
  SetFileAttributes "$INSTDIR\LICENSES.chromium.html" HIDDEN
  SetFileAttributes "$INSTDIR\resources.pak" HIDDEN
  SetFileAttributes "$INSTDIR\snapshot_blob.bin" HIDDEN
  SetFileAttributes "$INSTDIR\v8_context_snapshot.bin" HIDDEN
  SetFileAttributes "$INSTDIR\vk_swiftshader.dll" HIDDEN
  SetFileAttributes "$INSTDIR\vk_swiftshader_icd.json" HIDDEN
  SetFileAttributes "$INSTDIR\vulkan-1.dll" HIDDEN
  SetFileAttributes "$INSTDIR\dxgi.dll" HIDDEN

  ; Hide uninstaller and manifest
  SetFileAttributes "$INSTDIR\Uninstall Tavern Tones.exe" HIDDEN
  SetFileAttributes "$INSTDIR\TavernTones.visualelementsmanifest.xml" HIDDEN
!macroend

!macro customUnInstall
  ; Ask the user if they want to delete their AppData (autosaves, settings, etc.)
  MessageBox MB_YESNO "Do you want to delete all Tavern Tones settings and encounter data (AppData)?" IDNO +2
    RMDir /r "$APPDATA\Tavern Tones"
!macroend
