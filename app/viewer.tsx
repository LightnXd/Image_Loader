import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { Paths } from 'expo-file-system';
// Use legacy API to avoid deprecation warnings
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Image as RNImage,
  Text as RNText,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { useAppTheme } from '../lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ViewerScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(0);
  const lastScrollY = useRef(0);
  const videoRefs = useRef<{ [key: number]: Video | null }>({});
  const [itemLayouts, setItemLayouts] = useState<{ [key: number]: { y: number; height: number } }>({});
  const [mediaAspectRatios, setMediaAspectRatios] = useState<{ [key: number]: number }>({});
  const [localUris, setLocalUris] = useState<{ [key: number]: string }>({});
  const measuredVideos = useRef<Set<number>>(new Set());
  const visibleVideoIndices = useRef<Set<number>>(new Set());
  const sortedFilesRef = useRef<string[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'name'|'modified'|'type'|'random'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [sortedFiles, setSortedFiles] = useState<string[]>([]);
  const { dark: darkMode, bg, fg } = useAppTheme();

  // Parse file paths from params (memoized to prevent re-parsing)
  const files: string[] = useMemo(() => 
    params.files ? JSON.parse(params.files as string) : [], 
    [params.files]
  );
  const zipName: string = params.zipName as string || 'Viewer';

  const isVideo = (filePath: string | undefined): boolean => {
    if (!filePath) return false;
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    return videoExtensions.includes(ext);
  };

  // Load dimensions for images only (videos will get dimensions on load)
  // Initialize default aspect ratios (videos get a default until measured)
  useEffect(() => {
    files.forEach((file, index) => {
      if (isVideo(file)) {
        // Default aspect ratio for videos until they load
        setMediaAspectRatios(prev => ({
          ...prev,
          [index]: 16 / 9
        }));
      } else {
        // Default aspect ratio for images; will be corrected on image load
        setMediaAspectRatios(prev => ({
          ...prev,
          [index]: 1
        }));
      }
    });
    // initialize sortedFiles
    setSortedFiles(files.slice());
  }, [files]);

  // Keep ref in sync with sortedFiles state
  useEffect(() => {
    sortedFilesRef.current = sortedFiles;
  }, [sortedFiles]);

  // Re-sort whenever sort settings change
  useEffect(() => {
    const doSort = async () => {
      if (!files || files.length === 0) {
        setSortedFiles([]);
        return;
      }
      let arr = files.slice();
      if (sortBy === 'random') {
        // simple Fisher-Yates shuffle
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
      } else if (sortBy === 'name') {
        arr.sort((a, b) => {
          if (!a || !b) return 0;
          const na = a.substring(a.lastIndexOf('/') + 1).toLowerCase();
          const nb = b.substring(b.lastIndexOf('/') + 1).toLowerCase();
          return na.localeCompare(nb) * (sortAsc ? 1 : -1);
        });
      } else if (sortBy === 'type') {
        arr.sort((a, b) => {
          if (!a || !b) return 0;
          const ta = isVideo(a) ? '2' : '1';
          const tb = isVideo(b) ? '2' : '1';
          if (ta === tb) {
            const na = a.substring(a.lastIndexOf('/') + 1).toLowerCase();
            const nb = b.substring(b.lastIndexOf('/') + 1).toLowerCase();
            return na.localeCompare(nb) * (sortAsc ? 1 : -1);
          }
          return (ta < tb ? -1 : 1) * (sortAsc ? 1 : -1);
        });
      } else if (sortBy === 'modified') {
        // Attempt to fetch modification times; fallback to name sort if unavailable
        try {
          const infos = await Promise.all(arr.map(async (uri) => {
            try {
            const info = await FileSystem.getInfoAsync(uri);
              // expo FileSystem may expose modificationTime or modificationTimeMillis - try common fields
              const m = (info as any).modificationTime || (info as any).modificationTimeMillis || (info as any).mtime || 0;
              return { uri, m: m || 0 };
            } catch (e) {
              return { uri, m: 0 };
            }
          }));
          infos.sort((a, b) => (a.m - b.m) * (sortAsc ? 1 : -1));
          arr = infos.map(i => i.uri);
        } catch (e) {
          // fallback to name
          arr.sort((a, b) => {
            if (!a || !b) return 0;
            const na = a.substring(a.lastIndexOf('/') + 1).toLowerCase();
            const nb = b.substring(b.lastIndexOf('/') + 1).toLowerCase();
            return na.localeCompare(nb) * (sortAsc ? 1 : -1);
          });
        }
      }

      setSortedFiles(arr);
    };
    doSort();
  }, [sortBy, sortAsc, params.files]);

  const handleVideoReadyForDisplay = (index: number, event: any) => {
    if (measuredVideos.current.has(index)) return;
    
    console.log('Video ready:', index, event);
    const naturalSize = event.naturalSize || event.status?.naturalSize;
    if (naturalSize) {
      const { width, height } = naturalSize;
      if (width && height) {
        const aspectRatio = width / height;
        console.log(`Video ${index} dimensions: ${width}x${height}, aspect ratio: ${aspectRatio}`);
        measuredVideos.current.add(index);
        setMediaAspectRatios(prev => ({
          ...prev,
          [index]: aspectRatio
        }));
      }
    }
    
    // Auto-play video ONLY if it's currently visible
    const videoRef = videoRefs.current[index];
    if (videoRef && visibleVideoIndices.current.has(index)) {
      console.log(`Auto-playing video ${index} after ready (is visible)`);
      videoRef.playAsync().catch((err) => {
        console.warn(`Failed to auto-play video ${index} on ready:`, err);
      });
    }
  };

  // Handle viewable items changed for FlatList (better than scroll-based visibility)
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visibleIndices = new Set(
      viewableItems
        .map(item => item.index)
        .filter((index): index is number => index !== null && index !== undefined)
    );

    // Update the ref so handleVideoReadyForDisplay knows which videos are visible
    visibleVideoIndices.current = visibleIndices;

    console.log('Viewable items changed. Visible indices:', Array.from(visibleIndices));

    // Play videos that are visible, pause those that aren't
    Object.keys(videoRefs.current).forEach(key => {
      const index = parseInt(key);
      const videoRef = videoRefs.current[index];
      if (videoRef) {
        const isVisible = visibleIndices.has(index);
        const isVideoFile = isVideo(sortedFilesRef.current[index]);
        console.log(`Index ${index}: visible=${isVisible}, isVideo=${isVideoFile}, file=${sortedFilesRef.current[index]?.substring(sortedFilesRef.current[index]?.lastIndexOf('/') + 1)}`);
        
        if (isVisible && isVideoFile) {
          console.log(`Playing video at index ${index}`);
          videoRef.playAsync().catch((err) => {
            console.warn(`Failed to play video ${index}:`, err);
          });
        } else {
          console.log(`Pausing video at index ${index} (visible=${isVisible}, isVideo=${isVideoFile})`);
          videoRef.pauseAsync().catch(() => {});
        }
      }
    });
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 10, // Item is considered visible when 10% is on screen
    minimumViewTime: 100, // Minimum time (ms) item must be visible before callback fires
  }).current;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDelta = currentScrollY - lastScrollY.current;

    // Video visibility is now handled by onViewableItemsChanged (more efficient with FlatList)

    // Scroll up (pull down gesture) - show header
    if (scrollDelta < -5 && !headerVisible) {
      setHeaderVisible(true);
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    // Scroll down - hide header
    else if (scrollDelta > 5 && headerVisible) {
      setHeaderVisible(false);
      Animated.timing(headerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    lastScrollY.current = currentScrollY;
  };

  const handleLayout = (index: number, event: any) => {
    const { y, height } = event.nativeEvent.layout;
    setItemLayouts(prev => ({
      ...prev,
      [index]: { y, height }
    }));
  };

  const handleVideoDoubleTap = async (index: number) => {
    const videoRef = videoRefs.current[index];
    if (videoRef) {
      try {
        const status = await videoRef.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await videoRef.pauseAsync();
          } else {
            await videoRef.playAsync();
          }
        }
      } catch (err) {
        console.warn('Failed to toggle video playback:', err);
      }
    }
  };

  const renderMediaItem = (filePath: string, index: number) => {
    if (!filePath) {
      return <View key={index} style={styles.mediaContainer} />;
    }
    
    const aspectRatio = mediaAspectRatios[index] || 1;
    const displayUri = localUris[index] ?? filePath;
    
    if (isVideo(filePath)) {
      return (
        <TouchableOpacity
          key={index}
          style={styles.mediaContainer}
          activeOpacity={1}
          onPress={() => handleVideoDoubleTap(index)}
          onLayout={(e) => handleLayout(index, e)}
        >
          <Video
            ref={(ref) => { videoRefs.current[index] = ref; }}
            source={{ uri: displayUri }}
            style={[styles.media, { aspectRatio }]}
            useNativeControls={false}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
            isLooping
            onReadyForDisplay={(e) => handleVideoReadyForDisplay(index, e)}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && !measuredVideos.current.has(index)) {
                const videoStatus = status as any;
                if (videoStatus.naturalSize) {
                  const { width, height } = videoStatus.naturalSize;
                  if (width && height) {
                    console.log(`Video ${index} from status: ${width}x${height}`);
                    measuredVideos.current.add(index);
                    setMediaAspectRatios(prev => ({
                      ...prev,
                      [index]: width / height
                    }));
                  }
                }
              }
            }}
            onError={async (err) => {
              try {
                console.warn('Video failed to load directly, attempting to copy to cache:', filePath, err);
                if (filePath && filePath.startsWith && filePath.startsWith('content://')) {
                  const extMatch = filePath.match(/\.([a-zA-Z0-9]+)(?:$|\?)/);
                  const ext = extMatch ? `.${extMatch[1]}` : '.mp4';
                  const dest = `${Paths.cache}media_${index}_${Date.now()}${ext}`;
                  try {
                    await FileSystem.copyAsync({ from: filePath, to: dest });
                    setLocalUris(prev => ({ ...prev, [index]: dest }));
                    console.log('Copied content URI (video) to cache:', dest);
                  } catch (copyErr) {
                    console.warn('Failed to copy content URI (video) to cache:', copyErr);
                  }
                }
              } catch (e) {
                console.warn('Video onError fallback failed:', e);
              }
            }}
          />
        </TouchableOpacity>
      );
    } else {
      return (
        <View 
          key={index} 
          style={styles.mediaContainer}
          onLayout={(e) => handleLayout(index, e)}
        >
          <RNImage
            source={{ uri: displayUri }}
            style={[styles.media, { aspectRatio }]}
            resizeMode="cover"
            onLoad={(e) => {
              try {
                const { width, height } = (e.nativeEvent && (e.nativeEvent as any).source) || (e.nativeEvent && (e.nativeEvent as any).width && (e.nativeEvent as any).height ? { width: (e.nativeEvent as any).width, height: (e.nativeEvent as any).height } : {});
                if (width && height) {
                  setMediaAspectRatios(prev => ({ ...prev, [index]: width / height }));
                }
              } catch (err) {
                // ignore - keep default aspect ratio
                console.warn('onLoad failed to get image dimensions:', err);
              }
            }}
            onError={async (err) => {
              try {
                console.warn('Image failed to load directly, attempting to copy to cache:', filePath, err.nativeEvent || err);
                // If it's a content:// URI, try copying it to cache and use that copy
                if (filePath && filePath.startsWith && filePath.startsWith('content://')) {
                  const extMatch = filePath.match(/\.([a-zA-Z0-9]+)(?:$|\?)/);
                  const ext = extMatch ? `.${extMatch[1]}` : '.jpg';
                  const dest = `${Paths.cache}media_${index}_${Date.now()}${ext}`;
                  try {
                    // Attempt to copy the content URI to a cache file
                    await FileSystem.copyAsync({ from: filePath, to: dest });
                    setLocalUris(prev => ({ ...prev, [index]: dest }));
                    console.log('Copied content URI to cache:', dest);
                  } catch (copyErr) {
                    console.warn('Failed to copy content URI to cache:', copyErr);
                  }
                }
              } catch (e) {
                console.warn('onError fallback failed:', e);
              }
            }}
          />
        </View>
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}> 
      <FlatList
        data={sortedFiles}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={({ item, index }) => renderMediaItem(item, index)}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={5}
        removeClippedSubviews={false}
        updateCellsBatchingPeriod={100}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Collapsible Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerOpacity,
            transform: [
              {
                translateY: headerOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-80, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={headerVisible ? 'auto' : 'none'}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <RNText style={styles.headerTitle} numberOfLines={1} ellipsizeMode="middle">
            {zipName}
          </RNText>
          <TouchableOpacity style={styles.orderButton} onPress={() => setMenuVisible(true)}>
            <RNImage source={require('../assets/images/order.png')} style={{ width: 20, height: 20, tintColor: '#fff' }} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Sort menu modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuBox, { backgroundColor: bg }]}> 
            {(['name','modified','type','random'] as Array<'name'|'modified'|'type'|'random'>).map((opt) => {
              const isSelected = sortBy === opt;
              return (
                <Pressable key={opt} style={styles.menuRow} onPress={() => {
                  // 'random' has no asc/desc and should not show an arrow
                  if (opt === 'random') {
                    setSortBy('random');
                  } else if (sortBy === opt) {
                    setSortAsc(prev => !prev);
                  } else {
                    setSortBy(opt);
                  }
                  setMenuVisible(false);
                }}>
                  <RNText style={[styles.menuText, { color: isSelected ? '#007AFF' : fg }]}>
                    {opt === 'modified' ? 'Modified date' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </RNText>
                  <View style={styles.menuArrow}>{(isSelected && opt !== 'random') ? (
                    <RNText style={{ color: '#007AFF', fontSize: 16, fontWeight: '600' }}>{sortAsc ? '↑' : '↓'}</RNText>
                  ) : null}</View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    paddingTop: 75,
    paddingBottom: 50,
    backgroundColor: '#000',
  },
  mediaContainer: {
    width: SCREEN_WIDTH,
    paddingVertical: 0,
  },
  media: {
    width: SCREEN_WIDTH,
    backgroundColor: '#1a1a1a',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    paddingHorizontal: 15,
    zIndex: 1000,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 10,
  },
  placeholder: {
    width: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    color: '#fff',
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end' },
  menuBox: { width: 220, marginTop: 90, marginRight: 10, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  menuText: { fontSize: 14, color: '#222' },
  menuArrow: { width: 24, alignItems: 'flex-end' },
});
