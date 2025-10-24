import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getSavedItems, SavedItem } from '../lib/storage';

const PLACEHOLDER = require('../../assets/images/icon.png');

export default function SavedScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SavedItem[]>([]);

  const load = async () => {
    const list = await getSavedItems();
    setItems(list);
  };

  useEffect(() => {
    load();
  }, []);

  // Reload whenever the screen is focused so newly-saved items appear immediately
  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const openItem = (item: SavedItem) => {
    // Navigate to viewer using saved files (they should be cache file:// URIs)
    router.push({ pathname: '/viewer', params: { files: JSON.stringify(item.files), zipName: item.name } });
  };

  const renderItem = ({ item }: { item: SavedItem }) => (
    <TouchableOpacity style={styles.card} onPress={() => openItem(item)}>
      <Image source={PLACEHOLDER} style={styles.cover} resizeMode="cover" />
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="middle">{item.name}</Text>
      <Text style={styles.type}>{item.type === 'folder' ? 'Folder' : 'Zip'}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        numColumns={3}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={<Text style={styles.empty}>No saved items yet.</Text>}
      />
    </View>
  );
}

// Compute layout sizes based on screen width so spacing matches the design:
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_SIZE = SCREEN_WIDTH * 0.25; // 25% width/height per item
const GAP = SCREEN_WIDTH * 0.10; // 10% gap between items
const SIDE_PADDING = SCREEN_WIDTH * 0.025; // 2.5% left/right padding

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { paddingVertical: 12, paddingHorizontal: SIDE_PADDING },
  // column wrapper (one row of 3 items) — use space-between so
  // the remaining horizontal space produces two gaps of size GAP
  row: { justifyContent: 'space-between', marginBottom: GAP },
  card: { width: ITEM_SIZE, alignItems: 'center' },
  cover: { width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: 8, backgroundColor: '#eee' },
  name: { marginTop: 8, fontSize: 14, color: '#222', width: ITEM_SIZE, textAlign: 'center' },
  type: { fontSize: 12, color: '#666' },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
});
