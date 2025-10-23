# ZIP Media Viewer App

A React Native Expo app that reads ZIP files and displays images, GIFs, and videos.

## Features

✅ **ZIP File Support**: Select and extract ZIP files  
✅ **Media Display**: Shows images (.jpg, .jpeg, .png, .gif, .webp) and videos (.mp4, .mov, .avi, .mkv, .webm)  
✅ **Auto Layout**: Full-width media with 10px padding on each side, auto height  
✅ **Vertical Scroll**: One item per row in a scrollable column  
✅ **Collapsible Header**: Swipe down to show, swipe up to hide  
✅ **Back Navigation**: Return to home from header  
✅ **Auto Filter**: Ignores non-media files in the ZIP

## How It Works

### Home Screen (`app/(tabs)/index.tsx`)
- Simple UI with "Home" title
- "Select ZIP File" button
- Extracts ZIP to temp directory
- Filters for media files only
- Navigates to viewer with file list

### Viewer Screen (`app/viewer.tsx`)
- Displays media items in vertical ScrollView
- Each item: full screen width - 20px (10px padding each side)
- Images use `expo-image` for GIF support
- Videos use `expo-av` with native controls
- Header auto-hides on scroll up, shows on scroll down
- Semi-transparent header (0.8 opacity)
- Back button returns to home

## File Structure

```
app/
├── (tabs)/
│   └── index.tsx       # Home screen with ZIP selector
└── viewer.tsx          # Media viewer with collapsible header
```

## Dependencies

- `expo-document-picker` - File selection
- `expo-file-system` - File operations
- `react-native-zip-archive` - ZIP extraction
- `expo-av` - Video playback
- `expo-image` - Image & GIF display
- `@expo/vector-icons` - Icons

## Usage

1. Run the app: `npx expo start`
2. Tap "Select ZIP File"
3. Choose a ZIP containing images/videos
4. View media in scrollable list
5. Swipe up/down to hide/show header
6. Tap back button to return home

## Notes

- ZIP files are extracted to cache directory
- Only media files are displayed (images, GIFs, videos)
- Non-media files are automatically ignored
- Videos have native playback controls
- GIFs play automatically
- Header has 80% opacity for overlay effect
