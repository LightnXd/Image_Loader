# ZIP Media Viewer 📦

A small React Native + Expo app for browsing images and videos packed in ZIP files or stored inside folders on your device.

Features

- 📦 Select ZIP files and extract them (native unzip where available)
- 📁 Select a folder (Android SAF) and load media directly
- � Persistent "Saved" list (AsyncStorage) for quick access to folders and archives
- 🖼️ Image support: JPG, PNG, GIF, WEBP
- 🎬 Video support: MP4, MOV, AVI, MKV, WEBM with auto-play/pause based on visibility
- 🎛️ Viewer sorting (name / modified / type / random)
- ✍️ Saved list: long-press to multi-select, rename, or delete entries
- 🌗 Global light/dark theme toggle
- � Robust handling of content:// URIs (copies to app cache as fallback)

Getting started

1. Install dependencies:

```bash
npm install
```

2. Start Metro (development):

```bash
npm start
```

3. Run on Android (native build / dev client):

```bash
npm run android
```

Notes about native features

- The app uses native modules for two important behaviours:
	- `react-native-zip-archive` for native unzip (prevents JS memory OOM on large archives)
	- A small custom Android SAF helper (DirectoryPicker) to persist folder access and copy provider files into the app cache
- These native features require a native build or an Expo dev client. Use `npm run android` (or `npx expo run:android`) to get a build that includes native modules. Running in plain Expo Go will not expose them.

Quick usage

- Home / Selection screen:
	- Tap "Select ZIP File" to choose and extract a ZIP.
	- Tap "Select Folder" to pick an Android folder (grants SAF permission and copies files into cache).
	- Toggle light/dark theme with the switch.
- Saved tab:
	- Tap the Saved tab to see saved selections.
	- Long-press an item to enter selection mode; you can rename or delete saved entries.
	- Swipe left from Saved to return to Selection; swipe right from Selection to open Saved.
- Viewer:
	- Media are listed vertically; videos auto-pause/play when scrolled in/out of view.
	- Use the sort button in the header to reorder files.

