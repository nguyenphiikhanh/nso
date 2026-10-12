import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { GameProject } from '../types/project'
import { fetchProject, saveProject as persistProject } from '../services/project.api'

export function useProject() {
  const project = ref<GameProject | null>(null)
  const saveState = ref<'loading' | 'saved' | 'saving' | 'error'>('loading')
  const errorMessage = ref('')
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let saveVersion = 0
  let saveQueue: Promise<unknown> = Promise.resolve()

  async function loadProject() {
    try {
      project.value = await fetchProject()
      saveState.value = 'saved'
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Không thể mở project.'
      saveState.value = 'error'
    }
  }

  async function saveNow() {
    if (!project.value) return
    const currentVersion = ++saveVersion
    const snapshot = structuredClone(project.value)
    saveState.value = 'saving'
    errorMessage.value = ''
    saveQueue = saveQueue.catch(() => undefined).then(() => persistProject(snapshot))
    try {
      await saveQueue
      if (currentVersion === saveVersion) saveState.value = 'saved'
    } catch (error) {
      if (currentVersion === saveVersion) {
        errorMessage.value = error instanceof Error ? error.message : 'Không thể lưu project.'
        saveState.value = 'error'
      }
    }
  }

  function scheduleSave() {
    if (!project.value || saveState.value === 'loading') return
    saveState.value = 'saving'
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void saveNow(), 450)
  }

  watch(project, scheduleSave, { deep: true })
  onMounted(() => void loadProject())
  onUnmounted(() => {
    if (saveTimer) clearTimeout(saveTimer)
  })

  return { project, saveState, errorMessage, saveNow, loadProject }
}
