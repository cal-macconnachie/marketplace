<template>
  <div class="image-upload-dropzone">
    <input
      ref="imageInput"
      type="file"
      accept="image/*"
      @change="handleImageUpload"
      multiple
      style="display: none"
    />

    <!-- Uploaded Images -->
    <div v-if="modelValue.length > 0" class="uploaded-images">
      <div v-for="(image, index) in modelValue" :key="index" class="image-item">
        <div class="image-preview">
          <img :src="getImageUrl(image)" :alt="`Product image ${index + 1}`" />
          <button type="button" @click="removeImage(index)" class="remove-image-btn">×</button>
        </div>
        <div class="image-controls">
          <button
            type="button"
            @click="moveImageUp(index)"
            :disabled="index === 0"
            class="image-order-btn image-order-btn--left"
          ></button>
          <button
            type="button"
            @click="moveImageDown(index)"
            :disabled="index === modelValue.length - 1"
            class="image-order-btn image-order-btn--right"
          ></button>
        </div>
      </div>
    </div>

    <!-- Upload Area -->
    <div
      class="upload-area"
      :class="{
        'has-images': modelValue.length > 0,
        'drag-over': isDragOver,
        'has-error': uploadError,
      }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <div v-if="isUploading" class="upload-loading">
        <LoadingSpinner :size="24" />
        <span class="upload-text">Uploading</span>
      </div>
      <div v-else-if="uploadError" class="upload-error">
        <span class="error-text">{{ uploadError }}</span>
        <button class="retry-btn" @click="uploadError = null">Retry</button>
      </div>
      <div v-else class="upload-prompt" @click="triggerImageUpload">
        <span class="upload-text">
          {{ modelValue.length > 0 ? 'Add Images' : 'Upload Images' }}
        </span>
        <span class="upload-hint">Browse or drag files</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { domain } from '@marketplace/constants'
import LoadingSpinner from './LoadingSpinner.vue'

interface Props {
  modelValue: string[]
  uploading?: boolean
  onUpload?: (files: FileList) => Promise<void>
  maxFiles?: number
  maxSizeMB?: number
}

interface Emits {
  (e: 'update:modelValue', value: string[]): void
  (e: 'upload', files: FileList): void
  (e: 'error', message: string): void
}

const props = withDefaults(defineProps<Props>(), {
  uploading: false,
  maxFiles: 10,
  maxSizeMB: 5,
})

const emit = defineEmits<Emits>()

// Determine the image service URL based on environment
const IMAGE_URL = import.meta.env.VITE_API_ENV === 'dev'
  ? `https://images.${import.meta.env.VITE_API_ENV}.${domain}`
  : `https://images.${domain}`

// Construct the full image URL from the key
const getImageUrl = (imageKey: string) => {
  if (!imageKey) return ''
  // If it's already a full URL, return as-is
  if (imageKey.startsWith('http')) return imageKey
  // Otherwise construct the URL with query params for resizing
  return `${IMAGE_URL}/${imageKey}?w=300&h=300`
}

const imageInput = ref<HTMLInputElement>()
const isUploading = ref(false)
const isDragOver = ref(false)
const uploadError = ref<string | null>(null)

const triggerImageUpload = () => {
  imageInput.value?.click()
}

const validateFiles = (files: FileList): string | null => {
  if (props.modelValue.length + files.length > props.maxFiles) {
    return `Cannot upload more than ${props.maxFiles} images total`
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file.type.startsWith('image/')) {
      return `File "${file.name}" is not an image`
    }
    if (file.size > props.maxSizeMB * 1024 * 1024) {
      return `File "${file.name}" is larger than ${props.maxSizeMB}MB`
    }
  }

  return null
}

const handleImageUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  await processFiles(input.files)
}

const processFiles = async (files: FileList) => {
  uploadError.value = null

  const validationError = validateFiles(files)
  if (validationError) {
    uploadError.value = validationError
    emit('error', validationError)
    return
  }

  isUploading.value = true
  try {
    if (props.onUpload) {
      await props.onUpload(files)
    } else {
      emit('upload', files)
    }
    uploadError.value = null
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Upload failed'
    uploadError.value = errorMessage
    emit('error', errorMessage)
    console.error('Upload failed:', error)
  } finally {
    isUploading.value = false
    if (imageInput.value) {
      imageInput.value.value = ''
    }
  }
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false
}

const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false

  if (e.dataTransfer?.files) {
    await processFiles(e.dataTransfer.files)
  }
}

const removeImage = (index: number) => {
  const newImages = [...props.modelValue]
  newImages.splice(index, 1)
  emit('update:modelValue', newImages)
}

const moveImageUp = (index: number) => {
  if (index > 0) {
    const newImages = [...props.modelValue]
    ;[newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]]
    emit('update:modelValue', newImages)
  }
}

const moveImageDown = (index: number) => {
  if (index < props.modelValue.length - 1) {
    const newImages = [...props.modelValue]
    ;[newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]]
    emit('update:modelValue', newImages)
  }
}
</script>

<style scoped>
.image-upload-dropzone {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.uploaded-images {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: flex-start;
}

.image-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  max-width: 200px;
}

.image-preview {
  position: relative;
  width: 150px;
  height: 150px;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: var(--color-gray-100);
}

.remove-image-btn {
  position: absolute;
  top: var(--space-1);
  right: var(--space-1);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-error-600);
  color: white;
  border: none;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-image-btn:hover {
  background: var(--color-error-700);
}

.image-controls {
  display: flex;
  gap: var(--space-1);
  justify-content: center;
}

.image-order-btn {
  padding: var(--space-1) var(--space-2);
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-sm);
}

.image-order-btn--left::before {
  content: '‹';
  font-weight: bold;
  line-height: 1;
  margin-top: -2px;
}

.image-order-btn--right::before {
  content: '›';
  font-weight: bold;
  line-height: 1;
  margin-top: -2px;
}

.image-order-btn:hover:not(:disabled) {
  background: var(--color-gray-50);
}

.image-order-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-area {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-gray-25);
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-area.has-images {
  min-height: 60px;
}

.upload-area:hover:not(.has-error):not(.upload-loading) {
  border-color: var(--color-primary);
  background: var(--color-primary-25);
}

.upload-area.drag-over {
  border-color: var(--color-primary);
  background: var(--color-primary-50);
  transform: scale(1.02);
}

.upload-area.has-error {
  border-color: var(--color-error);
  background: var(--color-error-25);
}

.upload-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.upload-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  text-align: center;
  width: 100%;
  padding: var(--space-2);
}

.upload-text {
  font-weight: 500;
  color: var(--color-primary-700);
  font-size: var(--text-sm);
}

.upload-hint {
  font-size: var(--text-xs);
  color: var(--color-gray-500);
}

.upload-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
  width: 100%;
  padding: var(--space-2);
}

.error-text {
  color: var(--color-error-700);
  font-weight: 500;
  font-size: var(--text-sm);
}

.retry-btn {
  padding: var(--space-1) var(--space-2);
  background: var(--color-error-100);
  color: var(--color-error-700);
  border: 1px solid var(--color-error-200);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-sm);
}

.retry-btn:hover {
  background: var(--color-error-200);
}
</style>
