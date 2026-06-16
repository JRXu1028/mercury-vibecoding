export type ReaderViewMode = 'reader' | 'markdown' | 'summary' | 'translation'

export function resetAiView(view: ReaderViewMode): ReaderViewMode {
  return view === 'summary' || view === 'translation' ? 'reader' : view
}
