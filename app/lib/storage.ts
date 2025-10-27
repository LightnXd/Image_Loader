export * from '../../lib/storage';

// Provide a harmless default React component export so Expo Router does not treat this module
// as a missing/default-export page. The actual implementation lives in the root-level `lib`.
export default function _NonPage(): any {
  return null;
}
