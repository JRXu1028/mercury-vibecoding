const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('teamAApi', {
  listFeeds: () => ipcRenderer.invoke('feed:list'),
  addFeed: (url) => ipcRenderer.invoke('feed:add', { url }),
  removeFeed: (feedId) => ipcRenderer.invoke('feed:remove', { feedId }),
  syncFeed: (feedId) => ipcRenderer.invoke('feed:sync', { feedId }),
  syncAllFeeds: () => ipcRenderer.invoke('feed:syncAll'),
  listEntries: (params) => ipcRenderer.invoke('entry:list', params),
  getEntryContent: (entryId, options) => ipcRenderer.invoke('entry:content', { entryId, ...options }),
  importOpml: (content) => ipcRenderer.invoke('opml:import', { content }),
  exportOpml: () => ipcRenderer.invoke('opml:export'),
  openOpmlFile: () => ipcRenderer.invoke('opml:openFile'),
  saveOpmlFile: (content) => ipcRenderer.invoke('opml:saveFile', { content }),
  summarizeEntry: (entryId, options) => ipcRenderer.invoke('ai:summarizeEntry', { entryId, ...options }),
  translateEntry: (entryId, options) => ipcRenderer.invoke('ai:translateEntry', { entryId, ...options })
})
