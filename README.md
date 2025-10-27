# Image Loader 📦

A React Native + Expo app for viewing images and videos from ZIP files or folders on your Android device. Optimized for handling large collections of media files with memory-efficient rendering.

## ✨ Features

### Core Functionality
- 📦 **Native ZIP extraction** — Extract large ZIP files without JavaScript memory issues using `react-native-zip-archive`
- 📁 **Folder access (SAF)** — Select entire folders using Android Storage Access Framework
- 💾 **Persistent saved items** — Quick access to previously opened ZIPs/folders (AsyncStorage-backed with automatic deduplication)
- 🎯 **Memory-optimized viewer** — FlatList-based lazy loading keeps only ~5-15 images in memory at once, preventing OOM crashes
- ⏳ **Loading overlays** — Visual feedback during ZIP extraction, folder access, and navigation

### Media Support
- 🖼️ **Images**: JPG, JPEG, PNG, GIF, WEBP
- 🎬 **Videos**: MP4, MOV, AVI, MKV, WEBM
- 🎥 **Smart video playback** — Auto-play/pause based on scroll visibility (10% threshold with 100ms minimum view time)
- 🎮 **Video controls** — Tap to play/pause, auto-loop enabled

### UI & UX
- 🌓 **Global theme toggle** — Light/Dark mode with live updates across all screens
- 🎛️ **Flexible sorting** — Sort by name, modified date, type, or random (selected option highlighted in blue)
- ✍️ **Item management** — Long-press to select, rename, or delete saved items
- 👆 **Swipe navigation** — Swipe right on Home to open Saved; swipe left on Saved to return
- 📱 **Responsive grid layout** — Saved items displayed in a clean 3-column grid (25% item width, 10% gap)
- 🎨 **Auto-hiding header** — Scroll down to hide header in viewer, pull down to reveal

### Technical Features
- 🔒 **Robust URI handling** — Automatic fallback for `content://` URIs (copies to cache)
- 📂 **Real folder names** — Native picker returns actual folder name instead of generic "Folder"
- 🚫 **No duplicate saves** — Automatic deduplication based on files or name
- ⚡ **Optimized rendering** — FlatList with `windowSize=5`, `removeClippedSubviews=false`, and batch rendering
- 🔄 **Smart video state management** — Ref-based tracking to prevent race conditions in auto-play logic
- 🛡️ **Defensive programming** — Null safety checks throughout to handle edge cases gracefully

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Android Studio or Android SDK (for building)
- An Android device or emulator

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/LightnXd/Image_Loader.git
cd Image_Loader
```

2. **Install dependencies**
```bash
npm install
```

### Development

**Start Metro bundler**
```bash
npm start
```

**Run on Android (development build)**
```bash
npm run android
# or
npx expo run:android
```

> **Note:** Native modules (`react-native-zip-archive` and custom `DirectoryPicker`) require a development build or native APK. They will **not** work in Expo Go.

### Building Release APK

**Build release APK**
```bash
cd android
.\gradlew.bat assembleRelease
```

**Install on device**
```bash
adb install -r app\build\outputs\apk\release\app-release.apk
```

The release APK will be located at:
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 📖 Usage Guide

### Home / Selection Screen
- **Select ZIP File** — Choose a ZIP archive to extract and view
- **Select Folder** — Pick a folder using Android's folder picker (SAF)
- **Theme Toggle** — Switch between light and dark mode (persists across app restarts)
- **Swipe right** — Navigate to Saved tab

### Saved Tab
- View all previously opened ZIPs and folders
- **Tap an item** — Open and view its media
- **Long-press** — Enter selection mode
  - Select multiple items
  - Rename items (single selection only)
  - Delete selected items
- **Swipe left** — Return to Home screen

### Viewer
- **Scroll vertically** — Browse all images and videos
- **Videos** — Auto-play when visible (10%+ on screen), auto-pause when scrolled off-screen
- **Video interaction** — Tap any video to toggle play/pause
- **Header controls**:
  - Back button (top-left) — Return to previous screen
  - Sort button (top-right) — Change sort order (selected option shown in blue)
- **Sort options**: Name, Modified date, Type, Random
- **Auto-hide header** — Scroll down to hide header, pull down to show

---

## 🐛 Known Issues & Limitations

- **Expo Go compatibility**: Native modules are not available in Expo Go. Use `npx expo run:android` to build a development client.
- **Android only**: Folder picker and some native features are Android-specific.
- **Large video files**: Very large video files may still cause memory pressure on low-end devices (though optimized significantly).
- **Initial load delay**: First-time video auto-play may have a brief delay while video buffers.

---

## 🙏 Credits

Built with:
- [Expo](https://expo.dev/)
- [React Native](https://reactnative.dev/)
- [react-native-zip-archive](https://github.com/mockingbot/react-native-zip-archive)

---

**Developed by [LightnXd](https://github.com/LightnXd)**

