import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Image as RNImage,
  Text as RNText,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

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
  const measuredVideos = useRef<Set<number>>(new Set());
  const [showControlsForVideo, setShowControlsForVideo] = useState<number | null>(null);

  // Parse file paths from params (memoized to prevent re-parsing)
  const files: string[] = useMemo(() => 
    params.files ? JSON.parse(params.files as string) : [], 
    [params.files]
  );
  const zipName: string = params.zipName as string || 'Viewer';

  const isVideo = (filePath: string): boolean => {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    return videoExtensions.includes(ext);
  };

  // Load dimensions for images only (videos will get dimensions on load)
  useEffect(() => {
    files.forEach((file, index) => {
      if (!isVideo(file)) {
        // Get image dimensions
        RNImage.getSize(
          file,
          (width, height) => {
            setMediaAspectRatios(prev => ({
              ...prev,
              [index]: width / height
            }));
          },
          (error) => {
            console.error('Failed to get image size:', error);
            setMediaAspectRatios(prev => ({
              ...prev,
              [index]: 1
            }));
          }
        );
      } else {
        // Default aspect ratio for videos until they load
        setMediaAspectRatios(prev => ({
          ...prev,
          [index]: 16 / 9
        }));
      }
    });
  }, [files]);

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
  };

  const checkVisibility = useCallback((scrollPosition: number) => {
    Object.entries(itemLayouts).forEach(([index, layout]) => {
      const itemTop = layout.y;
      const itemBottom = layout.y + layout.height;
      const viewTop = scrollPosition;
      const viewBottom = scrollPosition + SCREEN_HEIGHT;

      const isVisible = itemBottom > viewTop && itemTop < viewBottom;
      const videoRef = videoRefs.current[parseInt(index)];

      if (videoRef) {
        if (isVisible) {
          videoRef.playAsync();
        } else {
          videoRef.pauseAsync();
        }
      }
    });
  }, [itemLayouts]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDelta = currentScrollY - lastScrollY.current;

    // Check video visibility
    checkVisibility(currentScrollY);

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

  const handleVideoDoubleTap = (index: number) => {
    setShowControlsForVideo(showControlsForVideo === index ? null : index);
  };

  const renderMediaItem = (filePath: string, index: number) => {
    const aspectRatio = mediaAspectRatios[index] || 1;
    
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
            source={{ uri: filePath }}
            style={[styles.media, { aspectRatio }]}
            useNativeControls={showControlsForVideo === index}
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
          <ExpoImage
            source={{ uri: filePath }}
            style={[styles.media, { aspectRatio }]}
            contentFit="cover"
            transition={200}
          />
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {files.map((file, index) => renderMediaItem(file, index))}
      </ScrollView>

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
          <View style={styles.placeholder} />
        </View>
      </Animated.View>
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
    paddingVertical: 0,
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
});
