const { contextBridge, ipcRenderer } = require('electron')

const appLogListeners = new Set()

ipcRenderer.on('app:log', (_event, entry) => {
  for (const listener of appLogListeners) {
    try {
      listener(entry)
    } catch {
      // Ignore listener errors.
    }
  }
})

contextBridge.exposeInMainWorld('teamDApi', {
  onAppLog: (callback) => {
    appLogListeners.add(callback)
    return () => {
      appLogListeners.delete(callback)
    }
  }
})

contextBridge.exposeInMainWorld('teamAApi', {
  listFeeds: () => ipcRenderer.invoke('feed:list'),
  addFeed: (url) => ipcRenderer.invoke('feed:add', { url }),
  removeFeed: (feedId) => ipcRenderer.invoke('feed:remove', { feedId }),
  syncFeed: (feedId) => ipcRenderer.invoke('feed:sync', { feedId }),
  syncAllFeeds: () => ipcRenderer.invoke('feed:syncAll'),
  listEntries: (params) => ipcRenderer.invoke('entry:list', params),
  importOpml: (content) => ipcRenderer.invoke('opml:import', { content }),
  exportOpml: () => ipcRenderer.invoke('opml:export'),
  openOpmlFile: () => ipcRenderer.invoke('opml:openFile'),
  saveOpmlFile: (content) => ipcRenderer.invoke('opml:saveFile', { content })
})

contextBridge.exposeInMainWorld('teamCApi', {
  getEntryContent: (entryId, options) => ipcRenderer.invoke('entry:content', { entryId, ...options }),
  summarizeEntry: (entryId, options) => ipcRenderer.invoke('ai:summarizeEntry', { entryId, ...options }),
  translateEntry: (entryId, options) => ipcRenderer.invoke('ai:translateEntry', { entryId, ...options })
})

contextBridge.exposeInMainWorld('teamBApi', {
  listNotes: (entryId) => ipcRenderer.invoke('notes:list', { entryId }),
  createNote: (entryId, content, title) => ipcRenderer.invoke('notes:create', { entryId, content, title }),
  updateNote: (noteId, fields) => ipcRenderer.invoke('notes:update', { noteId, ...fields }),
  deleteNote: (noteId) => ipcRenderer.invoke('notes:delete', { noteId }),
  listTags: () => ipcRenderer.invoke('tags:list'),
  createTag: (name, color) => ipcRenderer.invoke('tags:create', { name, color }),
  updateTag: (tagId, fields) => ipcRenderer.invoke('tags:update', { tagId, ...fields }),
  deleteTag: (tagId) => ipcRenderer.invoke('tags:delete', { tagId }),
  addTagToEntry: (entryId, tagId) => ipcRenderer.invoke('tags:addToEntry', { entryId, tagId }),
  removeTagFromEntry: (entryId, tagId) => ipcRenderer.invoke('tags:removeFromEntry', { entryId, tagId }),
  getTagsForEntry: (entryId) => ipcRenderer.invoke('tags:getForEntry', { entryId })
})
