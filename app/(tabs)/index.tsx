import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, NativeModules, PanResponder, PanResponderInstance, Platform, StyleSheet, Switch, Text, ToastAndroid, TouchableOpacity, View } from 'react-native';
import { unzip } from 'react-native-zip-archive';
import { saveItem } from '../../lib/storage';
import { useAppTheme } from '../../lib/theme';
import DirectoryPickerNative from '../lib/directoryPicker';

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { dark: darkMode, bg, fg, setDark } = useAppTheme();
  const toggleTheme = (value: boolean) => setDark(!!value);
  // Swipe to Saved: create a PanResponder to detect right swipes
  const panRef = useRef<PanResponderInstance | null>(null);
  if (!panRef.current) {
    panRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, vx } = gestureState;
        // right swipe
        if (dx > 80 && Math.abs(vx) > 0.15) {
          router.push({ pathname: '/saved' });
        }
      }
    });
  }
  const MEDIA_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi', '.mkv', '.webm'];

  const handleSelectFile = async () => {
    try {
      setLoading(true);
      console.log('Starting file selection...');
      
      // Pick a zip file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        copyToCacheDirectory: true,
      });

      console.log('DocumentPicker result:', result);

      if (result.canceled) {
        console.log('User canceled file selection');
        setLoading(false);
        return;
      }

      const file = result.assets[0];
      console.log('Selected file:', file.uri, file.name);
      
      // Use native unzip to extract the archive to cache to avoid loading the whole file into JS memory
      console.log('Unzipping file natively...');
      const tempDirName = `extracted_${Date.now()}`;
      // Resolve a reliable cache directory. On some environments FileSystem.cacheDirectory
      // may be undefined (warnings about legacy API); fall back to documentDirectory or a sensible path.
      let baseCache: string | null = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory ?? null;
      if (!baseCache) {
        // Fallback for Android app internal cache when expo API is not exposing cacheDirectory
        baseCache = '/data/user/0/com.anonymous.image_loader/cache/';
      }
      // Ensure trailing slash
      if (!baseCache.endsWith('/')) baseCache = baseCache + '/';
      const destPath = `${baseCache}${tempDirName}`;

  // DocumentPicker may return content:// URIs on Android or file:// URIs.
      // If we receive a content:// URI, copy it to cache first so native unzip can access a real file path.
      let srcPathRaw = file.uri;
      if (srcPathRaw && srcPathRaw.startsWith('content://')) {
        try {
          const tmpName = `upload_${Date.now()}_${file.name.replace(/[^a-z0-9_.-]/gi, '_')}`;
          const tmpDest = `${(FileSystem as any).cacheDirectory}${tmpName}`;
          console.log('Copying content:// URI to cache before unzip:', srcPathRaw, '->', tmpDest);
          await FileSystem.copyAsync({ from: srcPathRaw, to: tmpDest });
          srcPathRaw = tmpDest.startsWith('file://') ? tmpDest.replace('file://', '') : tmpDest;
        } catch (copyErr) {
          console.error('Failed to copy content URI to cache before unzip:', copyErr);
          Alert.alert('File access failed', 'Unable to prepare selected file for extraction.');
          setLoading(false);
          return;
        }
      }
      if (srcPathRaw.startsWith('file://')) srcPathRaw = srcPathRaw.replace('file://', '');
      let destPathRaw = destPath;
      if (destPathRaw.startsWith('file://')) destPathRaw = destPathRaw.replace('file://', '');

  // Log presence of the native module to help debug when running in Expo Go vs a dev client / native build
  console.log('NativeModules.RNZipArchive presence:', !!(NativeModules && (NativeModules as any).RNZipArchive));

  if (!NativeModules || !NativeModules.RNZipArchive) {
        console.warn('react-native-zip-archive native module not available (likely running in Expo Go).');
        Alert.alert(
          'Native unzip not available',
          'This feature requires a native module (react-native-zip-archive).\n\nTo process large ZIP files without running out of memory, run the app in a development build or a native build that includes this module.'
        );
        setLoading(false);
        return;
      }

      try {
        console.log('About to make dest dir and unzip. srcPathRaw:', srcPathRaw, ' destPathRaw:', destPathRaw);
        try {
          // Ensure we call expo FileSystem with a file:// URI (its APIs expect file:// URIs).
          const destUri = destPath.startsWith('file://') ? destPath : `file://${destPath}`;
          const srcUri = srcPathRaw.startsWith('file://') ? srcPathRaw : `file://${srcPathRaw}`;
          try {
            const srcInfo = await FileSystem.getInfoAsync(srcUri).catch(() => null);
            const beforeDestInfo = await FileSystem.getInfoAsync(destUri).catch(() => null);
            console.log('Pre-unzip file info src:', srcUri, srcInfo, ' dest:', destUri, beforeDestInfo);
          } catch (infoErr) {
            console.warn('Failed to get pre-unzip FileSystem info:', infoErr);
          }
          // ensure destination exists (some native unzip implementations expect the directory to exist)
          await FileSystem.makeDirectoryAsync(destUri, { intermediates: true }).catch((e) => {
            console.warn('makeDirectoryAsync returned error (ignored):', e);
          });
          // Probe write to ensure we can create files in the destination
          try {
            const probePath = destUri.endsWith('/') ? `${destUri}.probe` : `${destUri}/.probe`;
            await FileSystem.writeAsStringAsync(probePath, 'probe').catch(e => { throw e; });
            // remove probe
            await FileSystem.deleteAsync(probePath).catch(() => {});
            console.log('Probe write succeeded at', probePath);
          } catch (probeErr) {
            console.warn('Probe write failed for destUri:', destUri, probeErr);
          }
          try {
            const afterDestInfo = await FileSystem.getInfoAsync(destUri).catch(() => null);
            console.log('Post-mkdir dest info:', destUri, afterDestInfo);
          } catch (infoErr) {}
        } catch (mkErr) {
          console.warn('Failed to make dest dir (continuing):', mkErr);
        }
        try {
          await unzip(srcPathRaw, destPathRaw);
          console.log('Unzip complete to:', destPathRaw);
        } catch (innerUnzipErr) {
          console.error('Unzip threw (inner):', innerUnzipErr);
          throw innerUnzipErr;
        }
      } catch (unzipErr) {
        console.error('Unzip failed (outer):', unzipErr);
        // Try to surface as much detail as possible in the alert/logs
        try {
          const msg = typeof unzipErr === 'string' ? unzipErr : (unzipErr && (unzipErr as any).toString ? (unzipErr as any).toString() : JSON.stringify(unzipErr));
          Alert.alert('Unzip failed', msg);
        } catch (a) {}
        setLoading(false);
        return;
      }

      // Recursively collect media files from the extracted directory
      const mediaFiles: string[] = [];

      // Ensure the path provided to expo-file-system has a file:// scheme
      const toFileUri = (p: string) => p.startsWith('file://') ? p : `file://${p}`;

      async function collectFiles(dirUri: string) {
        try {
          // normalize directory URI
          const normalizedDir = dirUri.endsWith('/') ? dirUri : `${dirUri}/`;
          const entries = await FileSystem.readDirectoryAsync(normalizedDir);
          for (const name of entries) {
            const fullPath = `${normalizedDir}${name}`;
            const fullUri = toFileUri(fullPath);
            const info = await FileSystem.getInfoAsync(fullUri).catch(() => null);
            if (info && info.isDirectory) {
              await collectFiles(fullUri + '/');
            } else {
              const lower = name.toLowerCase();
              if (MEDIA_EXTENSIONS.some(ext => lower.endsWith(ext))) {
                // already a file:// URI
                mediaFiles.push(fullUri);
              }
            }
          }
        } catch (err) {
          console.error('Failed to read extracted directory:', err);
        }
      }

      const destUriForRead = toFileUri(destPathRaw.endsWith('/') ? destPathRaw : `${destPathRaw}/`);
      await collectFiles(destUriForRead);

      console.log('Total media files extracted:', mediaFiles.length);

      if (mediaFiles.length === 0) {
        Alert.alert('No Media Found', 'The zip file does not contain any images or videos.');
        setLoading(false);
        return;
      }

      // Save this zip selection for quick access later
      try {
        await saveItem({ name: file.name, type: 'zip', files: mediaFiles });
        const msg = 'Saved selection';
        if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
        else Alert.alert(msg);
      } catch (e) {
        console.warn('Failed to save selection:', e);
      }

      // Navigate to viewer with media files
      console.log('Navigating to viewer with', mediaFiles.length, 'files');
      router.push({
        pathname: '/viewer',
        params: {
          files: JSON.stringify(mediaFiles),
          zipName: file.name,
        },
      });

      setLoading(false);
    } catch (error: any) {
      console.error('Error selecting file:', error);
      console.error('Error stack:', error.stack);
      Alert.alert('Error', `Failed to process the file: ${error.message}`);
      setLoading(false);
    }
  };

  

  const handleNativeFolderAccess = async () => {
    try {
      setLoading(true);
      console.log('Requesting native folder access...');
      const pickResult: any = await DirectoryPickerNative.pickDirectory();
      const uris: string[] = (pickResult && Array.isArray(pickResult.files)) ? pickResult.files : (pickResult || []);
      const folderName: string = pickResult && pickResult.folderName ? pickResult.folderName : 'Folder';
      console.log('Native folder pick returned URIs count:', uris?.length, 'folderName:', folderName);

      const mediaFiles = (uris || []).filter(u => {
        const lower = u.toLowerCase();
        return MEDIA_EXTENSIONS.some(ext => lower.endsWith(ext));
      });

      if (mediaFiles.length === 0) {
        Alert.alert('No Media Found', 'The selected folder does not contain any images or videos.');
        setLoading(false);
        return;
      }

      // Save this folder selection for quick access later
      try {
        await saveItem({ name: folderName, type: 'folder', files: mediaFiles });
        const msg = 'Saved folder selection';
        if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
        else Alert.alert(msg);
      } catch (e) {
        console.warn('Failed to save folder selection:', e);
      }

      router.push({ pathname: '/viewer', params: { files: JSON.stringify(mediaFiles), zipName: folderName } });
      setLoading(false);
    } catch (error: any) {
      console.error('Native folder access error:', error);
      Alert.alert('Folder Access Failed', `${error?.message ?? error}`);
      setLoading(false);
    }
  };

  // theme is provided by AppThemeProvider (useAppTheme)

  return (
    <View {...(panRef.current ? panRef.current.panHandlers : {})} style={[styles.container, { backgroundColor: bg }]}> 
      <Text style={[styles.title, { color: fg }]}>Image Loader</Text>
      <View style={styles.themeRow}>
        <Text style={{ color: fg, marginRight: 8 }}>{darkMode ? 'Dark' : 'Light'}</Text>
        <Switch value={darkMode} onValueChange={toggleTheme} />
      </View>

      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleSelectFile}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: fg }]}>
          {loading ? 'Processing...' : 'Select ZIP File'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, styles.secondaryButton, loading && styles.buttonDisabled]}
        onPress={handleNativeFolderAccess}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: fg }]}> 
          {loading ? 'Processing...' : 'Select Folder'}
        </Text>
      </TouchableOpacity>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  secondaryButton: {
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  themeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBox: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
});