import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import JSZip from 'jszip';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
      
      // Read the zip file as base64 using expo-file-system
      console.log('Reading file as base64...');
      const zipFile = new File(file.uri);
      const base64Data = await zipFile.text(); // Read as text first
      
      // If that doesn't work, try reading as base64 directly
      let zipData;
      try {
        zipData = await zipFile.arrayBuffer();
        console.log('File read as ArrayBuffer, size:', zipData.byteLength);
      } catch (err) {
        console.log('ArrayBuffer failed, trying base64 method...');
        const base64Content = await zipFile.text();
        // Convert base64 to array buffer
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        zipData = bytes.buffer;
        console.log('File converted from base64, size:', zipData.byteLength);
      }
      
      // Load the zip file with JSZip
      console.log('Loading zip...');
      const zip = await JSZip.loadAsync(zipData);
      console.log('Zip loaded, files:', Object.keys(zip.files).length);
      
      // Create a temp directory for extraction
      const tempDir = new Directory(Paths.cache, `extracted_${Date.now()}`);
      tempDir.create();
      console.log('Temp directory created:', tempDir.uri);

      // Extract all files
      const mediaFiles: string[] = [];
      const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi', '.mkv', '.webm'];

      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir) {
          const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
          
          if (mediaExtensions.includes(ext)) {
            console.log('Extracting media file:', filename);
            // Get file content as base64
            const content = await zipEntry.async('base64');
            
            // Save to filesystem
            const savedFile = new File(tempDir, filename.replace(/\//g, '_'));
            await savedFile.write(content, { encoding: 'base64' });
            
            mediaFiles.push(savedFile.uri);
            console.log('Saved to:', savedFile.uri);
          }
        }
      }

      console.log('Total media files extracted:', mediaFiles.length);

      if (mediaFiles.length === 0) {
        Alert.alert('No Media Found', 'The zip file does not contain any images or videos.');
        setLoading(false);
        return;
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
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});