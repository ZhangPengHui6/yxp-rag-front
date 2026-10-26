<script setup lang="ts">
import { ref } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'

withDefaults(
  defineProps<{
    accept?: string
    title?: string
    hint?: string
    multiple?: boolean
  }>(),
  {
    accept: '.pdf,.docx,.zip,.png,.jpg,.jpeg',
    title: '拖拽文件到此处，或点击选择',
    hint: '支持 PDF / DOCX / ZIP / 图片，单文件 ≤ 200 MB',
    multiple: false
  }
)

const emit = defineEmits<{ (e: 'file', file: File): void }>()

const inputRef = ref<HTMLInputElement>()
const dragging = ref(false)
const picked = ref('')

function choose() {
  inputRef.value?.click()
}

function onChange(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (files && files[0]) handle(files[0])
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const files = event.dataTransfer?.files
  if (files && files[0]) handle(files[0])
}

function handle(file: File) {
  picked.value = file.name
  emit('file', file)
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ 'is-dragging': dragging }"
    role="button"
    tabindex="0"
    @click="choose"
    @keydown.enter="choose"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <el-icon class="dropzone-icon"><UploadFilled /></el-icon>
    <div class="dropzone-title">{{ picked || title }}</div>
    <div class="dropzone-hint">{{ hint }}</div>
    <input
      ref="inputRef"
      type="file"
      class="dropzone-input"
      :accept="accept"
      :multiple="multiple"
      @change="onChange"
    />
  </div>
</template>

<style scoped>
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 16px;
  border: 1px dashed var(--yxp-border-strong);
  border-radius: var(--yxp-radius);
  background: #fbfcfd;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}
.dropzone:hover,
.dropzone.is-dragging {
  border-color: var(--yxp-accent);
  background: var(--yxp-accent-weak);
}
.dropzone-icon {
  font-size: 28px;
  color: var(--yxp-accent);
}
.dropzone-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--yxp-text);
  word-break: break-all;
}
.dropzone-hint {
  font-size: 12px;
  color: var(--yxp-faint);
}
.dropzone-input {
  display: none;
}
</style>
