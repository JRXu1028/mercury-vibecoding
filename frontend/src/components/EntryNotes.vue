<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Delete, Edit, Plus } from '@element-plus/icons-vue'
import { teamBApi } from '../api/client'
import type { NoteItem } from '../types'

const props = defineProps<{ entryId: number }>()

const notes = ref<NoteItem[]>([])
const isLoading = ref(false)

const editDialogVisible = ref(false)
const editingNoteId = ref<number | null>(null)
const editTitle = ref('')
const editContent = ref('')
const isSaving = ref(false)

async function loadNotes(): Promise<void> {
  isLoading.value = true
  try {
    notes.value = await teamBApi.listNotes(props.entryId)
  } finally {
    isLoading.value = false
  }
}

function openCreate(): void {
  editingNoteId.value = null
  editTitle.value = ''
  editContent.value = ''
  editDialogVisible.value = true
}

function openEdit(note: NoteItem): void {
  editingNoteId.value = note.id
  editTitle.value = note.title ?? ''
  editContent.value = note.content
  editDialogVisible.value = true
}

async function saveNote(): Promise<void> {
  if (!editContent.value.trim()) return
  isSaving.value = true
  try {
    if (editingNoteId.value) {
      await teamBApi.updateNote(editingNoteId.value, {
        title: editTitle.value || null,
        content: editContent.value
      })
    } else {
      await teamBApi.createNote(
        props.entryId,
        editContent.value,
        editTitle.value || undefined
      )
    }
    editDialogVisible.value = false
    await loadNotes()
  } finally {
    isSaving.value = false
  }
}

async function deleteNote(noteId: number): Promise<void> {
  await teamBApi.deleteNote(noteId)
  await loadNotes()
}

onMounted(() => {
  void loadNotes()
})

watch(() => props.entryId, () => {
  void loadNotes()
})
</script>

<template>
  <div class="entry-notes">
    <div class="notes-header">
      <span class="notes-title">Notes ({{ notes.length }})</span>
      <el-button :icon="Plus" size="small" circle title="添加笔记" @click="openCreate" />
    </div>

    <div v-if="isLoading" v-loading="true" style="min-height: 40px" />

    <div v-else-if="notes.length === 0" class="notes-empty">
      <span>暂无笔记</span>
    </div>

    <div v-else class="notes-list">
      <div v-for="note in notes" :key="note.id" class="note-card">
        <div class="note-head">
          <span class="note-title">{{ note.title || 'Untitled' }}</span>
          <span class="note-time">{{ note.updatedAt.slice(0, 16).replace('T', ' ') }}</span>
        </div>
        <p class="note-content">{{ note.content }}</p>
        <div class="note-actions">
          <el-button :icon="Edit" size="small" link type="primary" @click="openEdit(note)">编辑</el-button>
          <el-popconfirm title="确认删除这条笔记？" @confirm="deleteNote(note.id)">
            <template #reference>
              <el-button :icon="Delete" size="small" link type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>
    </div>
  </div>

  <el-dialog
    v-model="editDialogVisible"
    :title="editingNoteId ? '编辑笔记' : '新建笔记'"
    width="500"
    :close-on-click-modal="false"
  >
    <el-form @submit.prevent="saveNote">
      <el-form-item label="标题">
        <el-input v-model="editTitle" placeholder="可选" />
      </el-form-item>
      <el-form-item label="内容">
        <el-input
          v-model="editContent"
          type="textarea"
          :rows="6"
          placeholder="笔记内容"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="isSaving" :disabled="!editContent.trim()" @click="saveNote">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.entry-notes {
  border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
  padding-top: 10px;
}

.notes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.notes-title {
  font-size: 14px;
  font-weight: 600;
}

.notes-empty {
  color: var(--el-text-color-secondary, #909399);
  font-size: 13px;
  padding: 8px 0;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.note-card {
  background: var(--el-fill-color-lighter, #f5f7fa);
  border-radius: 6px;
  padding: 10px 12px;
}

.note-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.note-title {
  font-size: 13px;
  font-weight: 500;
}

.note-time {
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
}

.note-content {
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.note-actions {
  display: flex;
  gap: 8px;
}
</style>
