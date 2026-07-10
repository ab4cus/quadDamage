set(PROJECT_NAME quad4damage)
set(PROJECT_VERSION 1.36)

# Binarios con marca propia (antes: ioq3ded / ioquake3)
set(SERVER_NAME q4ded)
set(CLIENT_NAME q4d)

set(BASEGAME baseq3)

set(CGAME_MODULE cgame)
set(GAME_MODULE qagame)
set(UI_MODULE ui)

set(WINDOWS_ICON_PATH ${CMAKE_SOURCE_DIR}/misc/windows/quake3.ico)

set(MACOS_ICON_PATH ${CMAKE_SOURCE_DIR}/misc/macos/quake3_flat.icns)
set(MACOS_BUNDLE_ID gg.play4chain.${CLIENT_NAME})

set(COPYRIGHT "QUAKE III ARENA Copyright © 1999-2000 id Software, Inc. All rights reserved.")

set(CONTACT_EMAIL "info@play4chain.gg")
set(PROTOCOL_HANDLER_SCHEME quad4damage)
