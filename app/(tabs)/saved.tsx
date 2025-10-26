import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, Modal, PanResponder, PanResponderInstance, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getSavedItems, removeItem, SavedItem, updateItemName } from '../lib/storage';
import { useAppTheme } from '../lib/theme';

const PLACEHOLDER = require('../../assets/images/folder.png');


export default function SavedScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const { dark: darkMode, bg, fg } = useAppTheme();

  // Swipe left to Selection: PanResponder
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
        // left swipe
        if (dx < -80 && Math.abs(vx) > 0.15) {
          router.push({ pathname: '/' });
        }
      }
    });
  }

  const load = async () => {
    const list = await getSavedItems();
    setItems(list);
  };

  useEffect(() => {
    load();
  }, []);

  // theme comes from AppThemeProvider via useAppTheme()

  // Reload whenever the screen is focused so newly-saved items appear immediately
  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const openItem = (item: SavedItem) => {
    // If selection mode is active, toggle selection instead of opening
    if (selectedIds.length > 0) {
      toggleSelect(item.id);
      return;
    }
    // Navigate to viewer using saved files (they should be cache file:// URIs)
    router.push({ pathname: '/viewer', params: { files: JSON.stringify(item.files), zipName: item.name } });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const copy = [...prev];
      const idx = copy.indexOf(id);
      if (idx === -1) copy.push(id);
      else copy.splice(idx, 1);
      return copy;
    });
  };

  const handleMenuPress = () => {
    if (selectedIds.length === 0) return;
    if (selectedIds.length === 1) {
      const id = selectedIds[0];
      const item = items.find(i => i.id === id);
      Alert.alert(
        item?.name ?? 'Options',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Rename', onPress: () => {
            setRenamingId(id);
            setRenameText(item?.name ?? '');
            setRenameModalVisible(true);
          } },
          { text: 'Delete', style: 'destructive', onPress: () => confirmDelete([id], load, () => setSelectedIds([])) },
        ]
      );
    } else {
      // multiple selection: only delete
      confirmDelete(selectedIds, load, () => setSelectedIds([]));
    }
  };

  

 

  return (
  <View {...(panRef.current ? panRef.current.panHandlers : {})} style={[styles.container, { backgroundColor: bg }]}> 
      <Modal visible={renameModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: bg }]}> 
            <Text style={[styles.modalTitle, { color: fg }]}>Rename</Text>
            <TextInput value={renameText} onChangeText={setRenameText} style={styles.modalInput} />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => { setRenameModalVisible(false); setRenamingId(null); }} style={styles.modalButton}>
                <Text style={{ color: fg }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={async () => {
                if (!renamingId) return;
                await updateItemName(renamingId, renameText.trim() || '');
                await load();
                setRenameModalVisible(false);
                setRenamingId(null);
                setSelectedIds([]);
              }} style={[styles.modalButton, { marginLeft: 12 }]}>
                <Text style={{ color: '#d00' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <View style={[styles.topbar, { backgroundColor: bg }]}> 
        <Text style={[styles.topbarTitle, { color: fg }]}>Saved</Text>
        <TouchableOpacity
          style={styles.topbarMenu}
          disabled={selectedIds.length === 0}
          onPress={() => handleMenuPress()}
        >
          <Image source={require('../../assets/images/menu.png')} style={[styles.menuIcon, { opacity: selectedIds.length > 0 ? 1 : 0, tintColor: fg }]} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item, index }) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <TouchableOpacity
              style={[
                styles.card,
                // add horizontal gap between cards except at end of row
                index % 3 !== 2 ? { marginRight: GAP } : undefined,
                isSelected ? styles.selectedCard : undefined,
              ]}
              onPress={() => openItem(item)}
              onLongPress={() => toggleSelect(item.id)}
            >
              <Image source={PLACEHOLDER} style={styles.cover} resizeMode="cover" />
                <Text style={[styles.name, { color: fg }]} numberOfLines={1} ellipsizeMode="middle">{item.name}</Text>
                <Text style={[styles.type, { color: fg }]}>{item.type === 'folder' ? 'Folder' : 'Zip'}</Text>
            </TouchableOpacity>
          );
        }}
        numColumns={3}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={<Text style={styles.empty}>No saved items yet.</Text>}
      />
    </View>
  );
}

async function confirmDelete(ids: string[], reload: () => Promise<void>, clearSelection: () => void) {
  Alert.alert(
    `Delete ${ids.length} item${ids.length > 1 ? 's' : ''}?`,
    'This will remove the saved selection(s). The underlying files will not be deleted.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          for (const id of ids) await removeItem(id);
        } catch (e) {
          console.warn('bulk delete error', e);
        }
        await reload();
        clearSelection();
      } }
    ]
  );
}


// Compute layout sizes based on screen width so spacing matches the design:
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_SIZE = SCREEN_WIDTH * 0.25; // 25% width/height per item
const GAP = SCREEN_WIDTH * 0.10; // 10% gap between items
const SIDE_PADDING = SCREEN_WIDTH * 0.025; // 2.5% left/right padding

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  // Topbar sits above the list and provides the title/menu area
  topbar: { backgroundColor: '#000', width: '100%', paddingBottom: 12, paddingTop: 50, paddingHorizontal: SIDE_PADDING, marginBottom: 30, justifyContent: 'center', alignItems: 'center' },
  topbarTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  topbarMenu: { position: 'absolute', right: 30, top: 50 },
  menuIcon: { width: 30, height: 30, opacity: 0, resizeMode: 'stretch', tintColor: '#fff' },
  list: { paddingVertical: 12, paddingHorizontal: SIDE_PADDING },
  // column wrapper: left-aligned rows (items flow left -> middle -> right)
  row: { justifyContent: 'flex-start', marginBottom: GAP },
  card: { width: ITEM_SIZE, alignItems: 'center' },
  cover: { width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: 8, backgroundColor: '#eee' },
  name: { marginTop: 8, fontSize: 14, color: '#222', width: ITEM_SIZE, textAlign: 'center' },
  type: { fontSize: 12, color: '#666' },
  selectedCard: { borderWidth: 2, borderColor: '#007AFF', backgroundColor: '#007AFF', opacity: 0.5 },
  // modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '90%', backgroundColor: '#fff', padding: 16, borderRadius: 8 },
  modalTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, marginBottom: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#eee' },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
});
