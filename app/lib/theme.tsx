
// Re-export the real implementation from the root-level lib so route scanning won't treat this
// file as a page that is missing a default export. The real implementation lives at /lib/theme.tsx
export * from '../../lib/theme';

export default function _NonPage() {
  return null;
}
