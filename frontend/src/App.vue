<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'
import FeedSidebar from './components/FeedSidebar.vue'
import EntryListPane from './components/EntryListPane.vue'
import EntryDetailPane from './components/EntryDetailPane.vue'
import { useFeedStore } from './stores/feed'
import { teamAApi } from './api/client'

const store = useFeedStore()

const sidebarCollapsed = ref(false)
const listCollapsed = ref(false)

const gridColumns = computed(() => {
  const sidebarWidth = sidebarCollapsed.value ? 44 : 280
  const listWidth = listCollapsed.value ? 44 : 360
  return `${sidebarWidth}px ${listWidth}px 1fr`
})

const addFeedDialogVisible = ref(false)
const importDialogVisible = ref(false)
const addFeedUrl = ref('')
const opmlContent = ref('')
const hasDesktopBridge = Boolean(window.teamAApi)
const autoSyncEnabled = ref(true)
const autoSyncIntervalMinutes = ref(10)
let autoSyncTimer: number | null = null

async function initialLoad(): Promise<void> {
  await store.refreshFeeds()
  await store.refreshEntries()
}

async function submitAddFeed(): Promise<void> {
  if (!addFeedUrl.value.trim()) {
    ElMessage.warning('Please input a feed URL')
    return
  }
  try {
    await store.addFeed(addFeedUrl.value.trim())
    ElMessage.success('Feed added')
    addFeedDialogVisible.value = false
    addFeedUrl.value = ''
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

async function removeFeed(feedId: number, feedTitle: string): Promise<void> {
  try {
    await ElMessageBox.confirm(`Delete feed \"${feedTitle}\"?`, 'Confirm', {
      type: 'warning'
    })
    await store.removeFeed(feedId)
    ElMessage.success('Feed removed')
  } catch {
    // User canceled
  }
}

async function syncCurrent(): Promise<void> {
  try {
    if (store.selectedFeedId === null) {
      const items = await store.syncAllFeeds()
      const total = items.reduce((sum, item) => sum + item.newEntryCount, 0)
      ElMessage.success(`Synced all feeds, ${total} new entries`)
    } else {
      const count = await store.syncFeed(store.selectedFeedId)
      ElMessage.success(`Synced current feed, ${count} new entries`)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

async function syncAllSilently(): Promise<void> {
  try {
    await store.syncAllFeeds()
  } catch {
    // Ignore timer sync error in silent mode.
  }
}

async function importOpml(): Promise<void> {
  if (!opmlContent.value.trim()) {
    ElMessage.warning('Please paste OPML content')
    return
  }
  try {
    const result = await store.importOpml(opmlContent.value)
    ElMessage.success(`Imported ${result.imported}, failed ${result.failed.length}`)
    importDialogVisible.value = false
    opmlContent.value = ''
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

async function importOpmlFile(file: File): Promise<void> {
  const content = await file.text()
  opmlContent.value = content
}

function onOpmlUploadChange(file: UploadFile): void {
  if (!file.raw) {
    return
  }
  void importOpmlFile(file.raw)
}

async function importOpmlFromDesktopFile(): Promise<void> {
  try {
    const result = await teamAApi.openOpmlFile()
    if (!result) {
      return
    }
    opmlContent.value = result.content
    ElMessage.success(`Loaded: ${result.filePath}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

async function exportOpml(): Promise<void> {
  try {
    const opml = await store.exportOpml()
    const desktopPath = await teamAApi.saveOpmlFile(opml)
    if (desktopPath) {
      ElMessage.success(`Exported to ${desktopPath}`)
      return
    }
    const blob = new Blob([opml], { type: 'text/x-opml;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `vibe-reader-feeds-${Date.now()}.opml`
    link.click()
    URL.revokeObjectURL(link.href)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

let searchDebounceTimer: number | null = null
function updateSearch(value: string): void {
  store.searchText = value
  if (searchDebounceTimer !== null) {
    window.clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = window.setTimeout(() => {
    void store.refreshEntries()
  }, 250)
}

function resetAutoSyncTimer(): void {
  if (autoSyncTimer !== null) {
    window.clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
  if (!autoSyncEnabled.value) {
    return
  }
  autoSyncTimer = window.setInterval(() => {
    void syncAllSilently()
  }, autoSyncIntervalMinutes.value * 60 * 1000)
}

function updateAutoSyncEnabled(value: boolean): void {
  autoSyncEnabled.value = value
  resetAutoSyncTimer()
}

function updateAutoSyncInterval(value: number): void {
  autoSyncIntervalMinutes.value = value
  resetAutoSyncTimer()
}

let removeLogListener: (() => void) | null = null

onMounted(() => {
  void initialLoad()
  resetAutoSyncTimer()

  if (window.teamDApi) {
    removeLogListener = window.teamDApi.onAppLog((entry) => {
      if (entry.level === 'error') {
        ElMessage.error(`[Main] ${entry.message}`)
      } else if (entry.level === 'warn') {
        ElMessage.warning(`[Main] ${entry.message}`)
      }
    })
  }
})

onBeforeUnmount(() => {
  if (autoSyncTimer !== null) {
    window.clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
  if (removeLogListener !== null) {
    removeLogListener()
    removeLogListener = null
  }
})
</script>

<template>
  <div class="page-shell">
    <main class="main-layout" :style="{ gridTemplateColumns: gridColumns }">
      <FeedSidebar
        :feeds="store.feeds"
        :selected-feed-id="store.selectedFeedId"
        :loading="store.isLoadingFeeds"
        :collapsed="sidebarCollapsed"
        :auto-sync-enabled="autoSyncEnabled"
        :auto-sync-interval-minutes="autoSyncIntervalMinutes"
        @select="(id) => { store.selectedFeedId = id; store.refreshEntries() }"
        @add="addFeedDialogVisible = true"
        @sync-all="syncCurrent"
        @import-opml="importDialogVisible = true"
        @export-opml="exportOpml"
        @remove="(feed) => removeFeed(feed.id, feed.title)"
        @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
        @update-auto-sync-enabled="updateAutoSyncEnabled"
        @update-auto-sync-interval="updateAutoSyncInterval"
      />

      <EntryListPane
        :entries="store.entries"
        :feeds="store.feeds"
        :selected-feed-id="store.selectedFeedId"
        :selected-entry-id="store.selectedEntryId"
        :loading="store.isLoadingEntries"
        :search-text="store.searchText"
        :collapsed="listCollapsed"
        @select-entry="(entryId) => (store.selectedEntryId = entryId)"
        @update-search="updateSearch"
        @sync-current="syncCurrent"
        @toggle-collapse="listCollapsed = !listCollapsed"
      />

      <EntryDetailPane :entry="store.selectedEntry" />
    </main>

    <el-dialog v-model="addFeedDialogVisible" title="Add Feed" width="460">
      <el-input v-model="addFeedUrl" placeholder="https://example.com/feed.xml" />
      <template #footer>
        <el-button @click="addFeedDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="submitAddFeed">Add</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="Import OPML" width="620">
      <el-button
        v-if="hasDesktopBridge"
        type="primary"
        plain
        @click="importOpmlFromDesktopFile"
      >
        Choose Local OPML File
      </el-button>
      <el-upload
        drag
        action="#"
        :auto-upload="false"
        :show-file-list="false"
        accept=".opml,.xml,text/xml"
        :on-change="onOpmlUploadChange"
      >
        <el-icon><UploadFilled /></el-icon>
        <div>Drop OPML file here, or click to select</div>
      </el-upload>
      <div class="import-divider">or paste OPML XML content</div>
      <el-input
        v-model="opmlContent"
        type="textarea"
        :rows="12"
        placeholder="Paste OPML XML content"
      />
      <template #footer>
        <el-button @click="importDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="importOpml">Import</el-button>
      </template>
    </el-dialog>
  </div>
</template>
