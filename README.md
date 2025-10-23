# ZIP Media Viewer 📦

A React Native Expo app that allows you to view images and videos from ZIP files.

## Features

- 📦 Select and extract ZIP files
- 🖼️ View images (JPG, PNG, GIF, WEBP)
- 🎬 Play videos (MP4, MOV, AVI, MKV, WEBM)
- 📱 Full-screen width media display
- ⏯️ Auto-play/pause videos based on visibility
- 🔄 Auto-adjusting media heights based on aspect ratio

## How to Use

1. Tap "Select ZIP File" on the home screen
2. Choose a ZIP file containing images and/or videos
3. Media files will be extracted and displayed vertically
4. Scroll through your media
5. Tap on videos to show/hide playback controls

## Installation

```bash
npm install
```

## Running the App

```bash
npm start
```

Or with custom script (Windows):
```powershell
.\start-metro.ps1
```

## Technologies

- React Native
- Expo SDK ~54
- expo-document-picker - File selection
- expo-file-system - File operations
- expo-av - Video playback
- expo-image - Optimized image rendering
- JSZip - ZIP file extraction
