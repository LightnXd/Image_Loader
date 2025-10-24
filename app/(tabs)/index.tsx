import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, NativeModules, Platform, StyleSheet, Text, ToastAndroid, TouchableOpacity, View } from 'react-native';
import { unzip } from 'react-native-zip-archive';
import DirectoryPickerNative from '../lib/directoryPicker';
import { saveItem } from '../lib/storage';

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
    const tempDir = new Directory(Paths.cache, tempDirName);
    const tempDirPath = tempDir.uri; // file://...

  // Ensure target directory exists by writing an empty file or using expo-file-system APIs if needed
  // react-native-zip-archive will create the directory when unzipping
  // Prepare source and destination paths for unzip.
      // DocumentPicker with copyToCacheDirectory=true should return a file:// URI pointing into the cache.
      let srcPathRaw = file.uri;
      if (srcPathRaw.startsWith('file://')) {
        srcPathRaw = srcPathRaw.replace('file://', '');
      }
      // Ensure destPath for unzip is a plain path (no file://)
      let destPathRaw = tempDirPath;
      if (destPathRaw.startsWith('file://')) {
        destPathRaw = destPathRaw.replace('file://', '');
      }

      console.log('Unzip source:', srcPathRaw, 'dest:', destPathRaw);
      // react-native-zip-archive is a native module and will be missing in Expo Go (NativeModules.RNZipArchive === undefined/null)
      if (!NativeModules || !NativeModules.RNZipArchive) {
        console.warn('react-native-zip-archive native module not available (likely running in Expo Go).');
        Alert.alert(
          'Native unzip not available',
          'This feature requires a native module (react-native-zip-archive).\n\nTo process large ZIP files without running out of memory, run the app in a development build or a native build that includes this module (for example: `npx expo prebuild` then `npx expo run:android`, or build an Expo dev client).'
        );
        setLoading(false);
        return;
      }

      try {
        await unzip(srcPathRaw, destPathRaw);
        console.log('Unzip complete to:', destPathRaw);
      } catch (unzipErr) {
        console.error('Unzip failed:', unzipErr);
        Alert.alert('Unzip failed', `${unzipErr}`);
        setLoading(false);
        return;
      }

      // Scan the extracted directory for media files
      const mediaFiles: string[] = [];
      const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi', '.mkv', '.webm'];

      // Use expo-file-system Directory and File helpers to read extracted files
      const extractedDir = new Directory(Paths.cache, tempDirName);
      // Read extracted directory contents using Directory.list()
      try {
        // Directory.list() is async; make sure to await it
        const entries = await extractedDir.list();
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            if (entry instanceof File) {
              const name = entry.name;
              const ext = name.toLowerCase().substring(name.lastIndexOf('.'));
              if (mediaExtensions.includes(ext)) {
                mediaFiles.push(entry.uri);
                console.log('Found media file:', entry.uri);
              }
            }
          }
        } else {
          console.warn('Extracted directory.list() returned unexpected value:', entries);
        }
      } catch (dirErr) {
        console.error('Failed to read extracted directory:', dirErr);
      }

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
          zipName: file.name
        }
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleSelectFile}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Processing...' : 'Select ZIP File'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, styles.secondaryButton, loading && styles.buttonDisabled]}
        onPress={handleNativeFolderAccess}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Processing...' : 'Grant Folder Access (native)'}
        </Text>
      </TouchableOpacity>
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
});