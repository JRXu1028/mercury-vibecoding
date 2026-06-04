<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { teamCApi } from '../api/client'
import type { ProviderInfo } from '../types'

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail'

interface ProviderRow extends ProviderInfo {
  testStatus: TestStatus
  testError: string | null
}

const rows = ref<ProviderRow[]>([])
const isLoading = ref(false)

const editDialogVisible = ref(false)
const editProviderId = ref('')
const editProviderName = ref('')
const editApiKey = ref('')
const isSaving = ref(false)
const saveError = ref('')

async function loadProviders(): Promise<void> {
  isLoading.value = true
  try {
    const list = await teamCApi.listProviders()
    rows.value = list.map((p) => ({ ...p, testStatus: 'idle', testError: null }))
  } finally {
    isLoading.value = false
  }
}

async function testConnection(row: ProviderRow): Promise<void> {
  row.testStatus = 'testing'
  row.testError = null
  try {
    const result = await teamCApi.testConnection(row.providerId)
    row.testStatus = result.ok ? 'ok' : 'fail'
    row.testError = result.error
  } catch (error) {
    row.testStatus = 'fail'
    row.testError = error instanceof Error ? error.message : String(error)
  }
}

function openEditDialog(row: ProviderRow): void {
  editProviderId.value = row.providerId
  editProviderName.value = row.name
  editApiKey.value = ''
  saveError.value = ''
  editDialogVisible.value = true
}

async function saveApiKey(): Promise<void> {
  if (!editApiKey.value.trim()) {
    saveError.value = 'API Key 不能为空'
    return
  }
  isSaving.value = true
  saveError.value = ''
  try {
    const result = await teamCApi.saveProviderApiKey(editProviderId.value, editApiKey.value.trim())
    if (result.ok) {
      editDialogVisible.value = false
      await loadProviders()
    } else {
      saveError.value = result.error ?? '保存失败'
    }
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  void loadProviders()
})
</script>

<template>
  <div class="provider-panel">
    <div class="provider-panel-header">
      <span class="provider-panel-title">AI Provider 管理</span>
      <el-button
        circle
        :icon="Refresh"
        :loading="isLoading"
        size="small"
        title="刷新 Provider 列表"
        @click="loadProviders"
      />
    </div>

    <el-table :data="rows" v-loading="isLoading" size="small" style="width: 100%">
      <el-table-column label="Provider" min-width="130">
        <template #default="{ row }">
          <div class="provider-name">{{ row.name }}</div>
          <div class="provider-id">{{ row.providerId }}</div>
        </template>
      </el-table-column>

      <el-table-column label="默认模型" prop="defaultModel" min-width="120">
        <template #default="{ row }">
          <span class="muted">{{ row.defaultModel ?? '—' }}</span>
        </template>
      </el-table-column>

      <el-table-column label="API Key" min-width="200">
        <template #default="{ row }">
          <template v-if="row.apiKeyEnvVar">
            <div class="key-cell">
              <span v-if="row.hasStoredKey" class="key-masked">●●●●●●●●</span>
              <span v-else class="muted">未配置</span>
              <el-button
                size="small"
                link
                type="primary"
                @click="openEditDialog(row)"
              >{{ row.hasStoredKey ? '修改' : '设置' }}</el-button>
            </div>
            <div class="env-hint">
              <code class="env-var">{{ row.apiKeyEnvVar }}</code>
              <span class="muted"> 环境变量也可用</span>
            </div>
          </template>
          <span v-else class="muted">不需要</span>
        </template>
      </el-table-column>

      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag v-if="row.available" type="success" size="small">可用</el-tag>
          <el-tag v-else type="warning" size="small">未配置</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="连通性" min-width="160">
        <template #default="{ row }">
          <el-button
            size="small"
            plain
            :loading="row.testStatus === 'testing'"
            :disabled="row.testStatus === 'testing'"
            @click="testConnection(row)"
          >
            测试连接
          </el-button>
          <span v-if="row.testStatus === 'ok'" class="test-ok">连接成功</span>
          <el-tooltip
            v-else-if="row.testStatus === 'fail'"
            :content="row.testError ?? '未知错误'"
            placement="top"
            :show-after="0"
          >
            <span class="test-fail">连接失败</span>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <p class="provider-hint">
      API Key 可在此界面配置，加密存储在本地数据库中；也可在启动时通过 shell 环境变量注入。应用内不会明文展示密钥。
    </p>
  </div>

  <el-dialog
    v-model="editDialogVisible"
    :title="`设置 API Key — ${editProviderName}`"
    width="420"
    :close-on-click-modal="false"
    append-to-body
  >
    <el-form @submit.prevent="saveApiKey">
      <el-form-item label="API Key">
        <el-input
          v-model="editApiKey"
          type="password"
          show-password
          placeholder="输入 API Key"
          autofocus
        />
      </el-form-item>
      <el-alert
        v-if="saveError"
        type="error"
        :title="saveError"
        show-icon
        :closable="false"
        style="margin-top: 8px"
      />
    </el-form>
    <template #footer>
      <el-button @click="editDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="isSaving" @click="saveApiKey">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.provider-panel {
  padding: 4px 0;
}

.provider-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.provider-panel-title {
  font-size: 14px;
  font-weight: 600;
}

.provider-name {
  font-size: 13px;
  font-weight: 500;
}

.provider-id {
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
}

.key-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.key-masked {
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--el-text-color-regular, #606266);
}

.env-hint {
  margin-top: 2px;
  font-size: 11px;
}

.env-var {
  font-size: 11px;
  background: var(--el-fill-color-light, #f5f7fa);
  padding: 1px 4px;
  border-radius: 3px;
}

.muted {
  color: var(--el-text-color-secondary, #909399);
  font-size: 12px;
}

.test-ok {
  margin-left: 6px;
  color: var(--el-color-success, #67c23a);
  font-size: 12px;
}

.test-fail {
  margin-left: 6px;
  color: var(--el-color-danger, #f56c6c);
  font-size: 12px;
  cursor: help;
  text-decoration: underline dotted;
}

.provider-hint {
  margin: 12px 0 0;
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
}
</style>
