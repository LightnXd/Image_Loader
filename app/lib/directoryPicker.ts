import { NativeModules } from 'react-native';

const { DirectoryPickerModule } = NativeModules as any;

export type PickDirectoryResult = {
  files: string[];
  folderName?: string;
  treeUri?: string;
};

export default {
  pickDirectory: async (): Promise<PickDirectoryResult> => {
    if (!DirectoryPickerModule || !DirectoryPickerModule.pickDirectory) {
      throw new Error('DirectoryPickerModule not available; make sure you are running a native build or dev client.');
    }
    // The native module now resolves to an object { files: string[], folderName?: string, treeUri?: string }
    return await DirectoryPickerModule.pickDirectory();
  }
};
