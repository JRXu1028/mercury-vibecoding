<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Close, Plus } from '@element-plus/icons-vue'
import { teamBApi } from '../api/client'
import type { TagItem, TagWithCount } from '../types'

const props = defineProps<{ entryId: number }>()

const entryTags = ref<TagItem[]>([])
const allTags = ref<TagWithCount[]>([])
const isLoading = ref(false)

const addDialogVisible = ref(false)
const newTagName = ref('')
const newTagColor = ref('#409EFF')
const isCreating = ref(false)

async function loadEntryTags(): Promise<void> {
  isLoading.value = true
  try {
    entryTags.value = await teamBApi.getTagsForEntry(props.entryId)
  } finally {
    isLoading.value = false
  }
}

async function loadAllTags(): Promise<void> {
  allTags.value = await teamBApi.listTags()
}

async function removeTag(tagId: number): Promise<void> {
  await teamBApi.removeTagFromEntry(props.entryId, tagId)
  await loadEntryTags()
  await loadAllTags()
}

async function addExistingTag(tagId: number): Promise<void> {
  await teamBApi.addTagToEntry(props.entryId, tagId)
  addDialogVisible.value = false
  await loadEntryTags()
  await loadAllTags()
}

async function createAndAdd(): Promise<void> {
  if (!newTagName.value.trim()) return
  isCreating.value = true
  try {
    const tag = await teamBApi.createTag(newTagName.value.trim(), newTagColor.value)
    await teamBApi.addTagToEntry(props.entryId, tag.id)
    addDialogVisible.value = false
    newTagName.value = ''
    newTagColor.value = '#409EFF'
    await loadEntryTags()
    await loadAllTags()
  } finally {
    isCreating.value = false
  }
}

function openAddDialog(): void {
  newTagName.value = ''
  newTagColor.value = '#409EFF'
  addDialogVisible.value = true
}

const assignedIds = ref(new Set<number>())
watch(entryTags, (tags) => {
  assignedIds.value = new Set(tags.map((t) => t.id))
})

const unassignedTags = ref<TagWithCount[]>([])
watch([allTags, assignedIds], ([tags, ids]) => {
  unassignedTags.value = tags.filter((t) => !ids.has(t.id))
})

onMounted(() => {
  void loadEntryTags()
  void loadAllTags()
})

watch(() => props.entryId, () => {
  void loadEntryTags()
})
</script>

<template>
  <div class="entry-tags" v-loading="isLoading">
    <span class="tags-label">Tags:</span>
    <el-tag
      v-for="tag in entryTags"
      :key="tag.id"
      :color="tag.color ?? undefined"
      size="small"
      closable
      @close="removeTag(tag.id)"
      class="tag-chip"
    >
      {{ tag.name }}
    </el-tag>
    <el-button :icon="Plus" size="small" circle title="添加标签" @click="openAddDialog" />
  </div>

  <el-dialog v-model="addDialogVisible" title="添加标签" width="400" :close-on-click-modal="false">
    <div v-if="unassignedTags.length > 0" class="existing-tags-section">
      <p class="section-label">已有标签（点击添加）</p>
      <div class="tag-list">
        <el-tag
          v-for="tag in unassignedTags"
          :key="tag.id"
          :color="tag.color ?? undefined"
          size="small"
          class="tag-chip clickable"
          @click="addExistingTag(tag.id)"
        >
          {{ tag.name }} ({{ tag.entryCount }})
        </el-tag>
      </div>
    </div>

    <div class="new-tag-section">
      <p class="section-label">创建新标签</p>
      <div class="new-tag-form">
        <el-input v-model="newTagName" placeholder="标签名" size="small" @keyup.enter="createAndAdd" />
        <el-color-picker v-model="newTagColor" size="small" />
        <el-button type="primary" size="small" :loading="isCreating" @click="createAndAdd">创建并添加</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.entry-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 0 30px 6px;
}

.tags-label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 650;
}

.tag-chip {
  cursor: default;
  border: 0;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
}

.tag-chip.clickable {
  cursor: pointer;
}

.existing-tags-section {
  margin-bottom: 16px;
}

.section-label {
  font-size: 13px;
  color: var(--muted);
  margin: 0 0 8px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.new-tag-section {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.new-tag-form {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
