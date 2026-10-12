import { ref, reactive, computed, watch } from 'vue'
import type {
  ActionType,
  ActionStepItem,
  ActionDefinitionItem,
  ActionSequence,
  CharacterCategory,
} from '../types/character'
import type { NsoPart } from '../types/nso'

export const actionLabels: Record<ActionType, string> = {
  idle: 'Đứng yên',
  walk: 'Chạy / Di chuyển',
  attack: 'Đánh kiếm / Tấn công',
  jump: 'Nhảy / Bay cao',
}

export const defaultActionPresets: Record<ActionType, ActionDefinitionItem> = {
  idle: {
    id: 'idle',
    label: 'Đứng yên',
    icon: '🧘',
    fps: 6,
    steps: [
      {
        id: 'idle-0',
        name: 'Thở nhẹ 1',
        headFrame: 0,
        bodyFrame: 1,
        legFrame: 1,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: 0,
        breathBob: 0,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 0, dy: 0, rot: 0 },
        shadowScale: 1.0,
        shadowOpacity: 0.75,
      },
      {
        id: 'idle-1',
        name: 'Thở nhẹ 2',
        headFrame: 0,
        bodyFrame: 1,
        legFrame: 1,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: 0,
        breathBob: 0,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 0, dy: 0, rot: 0 },
        shadowScale: 1.0,
        shadowOpacity: 0.75,
      },
      {
        id: 'idle-2',
        name: 'Nhấp nhô 1',
        headFrame: 1,
        bodyFrame: 1,
        legFrame: 1,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: 0,
        breathBob: 1,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 0, dy: 1, rot: 0 },
        shadowScale: 1.0,
        shadowOpacity: 0.75,
      },
      {
        id: 'idle-3',
        name: 'Nhấp nhô 2',
        headFrame: 1,
        bodyFrame: 1,
        legFrame: 1,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: 0,
        breathBob: 1,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 0, dy: 1, rot: 0 },
        shadowScale: 1.0,
        shadowOpacity: 0.75,
      },
    ],
  },
  walk: {
    id: 'walk',
    label: 'Chạy / Di chuyển',
    icon: '🏃',
    fps: 8,
    steps: [
      {
        id: 'walk-0',
        name: 'Bước chạm',
        headFrame: 0,
        bodyFrame: 2,
        legFrame: 2,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: 0,
        breathBob: 0,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 0, dy: 0, rot: 0 },
        shadowScale: 1.0,
        shadowOpacity: 0.75,
      },
      {
        id: 'walk-1',
        name: 'Nhún chân 1',
        headFrame: 1,
        bodyFrame: 3,
        legFrame: 3,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: 0,
        breathBob: 1,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 1, dy: 1, rot: 2 },
        shadowScale: 0.96,
        shadowOpacity: 0.7,
      },
      {
        id: 'walk-2',
        name: 'Đẩy đà 1',
        headFrame: 0,
        bodyFrame: 4,
        legFrame: 4,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: 0,
        breathBob: 0,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 0, dy: 0, rot: 0 },
        shadowScale: 1.0,
        shadowOpacity: 0.75,
      },
      {
        id: 'walk-3',
        name: 'Chuyển thế',
        headFrame: 1,
        bodyFrame: 5,
        legFrame: 5,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: 0,
        breathBob: 1,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: -1, dy: 1, rot: -2 },
        shadowScale: 0.96,
        shadowOpacity: 0.7,
      },
      {
        id: 'walk-4',
        name: 'Nhún chân 2',
        headFrame: 0,
        bodyFrame: 6,
        legFrame: 6,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: 0,
        breathBob: 0,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 0, dy: 0, rot: 0 },
        shadowScale: 1.0,
        shadowOpacity: 0.75,
      },
      {
        id: 'walk-5',
        name: 'Đẩy đà 2',
        headFrame: 1,
        bodyFrame: 7,
        legFrame: 7,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: 0,
        breathBob: 1,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 1, dy: 1, rot: 2 },
        shadowScale: 0.96,
        shadowOpacity: 0.7,
      },
    ],
  },
  attack: {
    id: 'attack',
    label: 'Đánh kiếm / Tấn công',
    icon: '⚔️',
    fps: 6,
    steps: [
      {
        id: 'atk-0',
        name: 'Lấy đà (Windup)',
        headFrame: 4,
        bodyFrame: 8,
        legFrame: 8,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: 0,
        breathBob: 0,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: -8, dy: -4, rot: 0 },
        shadowScale: 1.0,
        shadowOpacity: 0.75,
      },
      {
        id: 'atk-1',
        name: 'Giương kiếm (Overhead)',
        headFrame: 5,
        bodyFrame: 9,
        legFrame: 9,
        weaponFrame: 1,
        lungeX: 2,
        jumpY: 0,
        breathBob: -1,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 0, dy: -16, rot: -15 },
        shadowScale: 1.0,
        shadowOpacity: 0.75,
      },
      {
        id: 'atk-2',
        name: 'Chém bổ (Slash)',
        headFrame: 6,
        bodyFrame: 10,
        legFrame: 8,
        weaponFrame: 1,
        lungeX: 8,
        jumpY: 0,
        breathBob: 1,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 18, dy: 6, rot: 15 },
        shadowScale: 1.05,
        shadowOpacity: 0.8,
      },
      {
        id: 'atk-3',
        name: 'Thu kiếm (Recover)',
        headFrame: 7,
        bodyFrame: 11,
        legFrame: 9,
        weaponFrame: 1,
        lungeX: 4,
        jumpY: 0,
        breathBob: 0,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 12, dy: 2, rot: 0 },
        shadowScale: 1.0,
        shadowOpacity: 0.75,
      },
    ],
  },
  jump: {
    id: 'jump',
    label: 'Nhảy / Bay cao',
    icon: '⚡',
    fps: 6,
    steps: [
      {
        id: 'jmp-0',
        name: 'Bật nhảy (Takeoff)',
        headFrame: 2,
        bodyFrame: 12,
        legFrame: 8,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: -18,
        breathBob: 0,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 2, dy: -2, rot: -5 },
        shadowScale: 0.85,
        shadowOpacity: 0.6,
      },
      {
        id: 'jmp-1',
        name: 'Bay vút (Ascent)',
        headFrame: 3,
        bodyFrame: 13,
        legFrame: 8,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: -42,
        breathBob: 0,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 4, dy: -4, rot: -10 },
        shadowScale: 0.6,
        shadowOpacity: 0.4,
      },
      {
        id: 'jmp-2',
        name: 'Đỉnh nhảy (Apex)',
        headFrame: 2,
        bodyFrame: 14,
        legFrame: 8,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: -56,
        breathBob: 0,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 6, dy: -6, rot: -12 },
        shadowScale: 0.45,
        shadowOpacity: 0.25,
      },
      {
        id: 'jmp-3',
        name: 'Rơi xuống (Fall)',
        headFrame: 3,
        bodyFrame: 12,
        legFrame: 8,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: -35,
        breathBob: 0,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 4, dy: -2, rot: -5 },
        shadowScale: 0.7,
        shadowOpacity: 0.5,
      },
      {
        id: 'jmp-4',
        name: 'Tiếp đất (Land)',
        headFrame: 0,
        bodyFrame: 1,
        legFrame: 8,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: -4,
        breathBob: 0,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 0, dy: 2, rot: 5 },
        shadowScale: 1.05,
        shadowOpacity: 0.8,
      },
      {
        id: 'jmp-5',
        name: 'Hồi phục (Recover)',
        headFrame: 0,
        bodyFrame: 1,
        legFrame: 1,
        weaponFrame: 1,
        lungeX: 0,
        jumpY: 0,
        breathBob: 0,
        neckOffset: 0,
        waistOffset: 0,
        headOffset: { dx: 0, dy: 0 },
        bodyOffset: { dx: 0, dy: 0 },
        legOffset: { dx: 0, dy: 0 },
        weaponOffset: { dx: 0, dy: 0, rot: 0 },
        shadowScale: 1.0,
        shadowOpacity: 0.75,
      },
    ],
  },
}

export function ensureStepPartOffsets(s: ActionStepItem): ActionStepItem {
  if (typeof s.neckOffset !== 'number') s.neckOffset = 0
  if (typeof s.waistOffset !== 'number') s.waistOffset = 0
  if (!s.headOffset) s.headOffset = { dx: 0, dy: 0 }
  if (!s.bodyOffset) s.bodyOffset = { dx: 0, dy: 0 }
  if (!s.legOffset) s.legOffset = { dx: 0, dy: 0 }
  if (!s.weaponOffset) s.weaponOffset = { dx: 0, dy: 0, rot: 0 }
  if (!s.zIndices) s.zIndices = { head: 1, body: 1, leg: 1, weapon: 1, mask: 1 }
  if (typeof s.zIndices.head !== 'number') s.zIndices.head = 1
  if (typeof s.zIndices.body !== 'number') s.zIndices.body = 1
  if (typeof s.zIndices.leg !== 'number') s.zIndices.leg = 1
  if (typeof s.zIndices.weapon !== 'number') s.zIndices.weapon = 1
  if (typeof s.zIndices.mask !== 'number') s.zIndices.mask = 1
  return s
}

export function loadActionDefinitions(): Record<ActionType, ActionDefinitionItem> {
  try {
    const raw = localStorage.getItem('nso_character_action_definitions_v1')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.idle && parsed.walk && parsed.attack && parsed.jump) {
        for (const k of ['idle', 'walk', 'attack', 'jump'] as const) {
          if (Array.isArray(parsed[k]?.steps)) {
            parsed[k].steps.forEach((s: ActionStepItem) => ensureStepPartOffsets(s))
          }
        }
        return parsed
      }
    }
  } catch (err) {
    console.error('Failed to parse saved action definitions:', err)
  }
  const def = JSON.parse(JSON.stringify(defaultActionPresets))
  for (const k of ['idle', 'walk', 'attack', 'jump'] as const) {
    def[k].steps.forEach((s: ActionStepItem) => ensureStepPartOffsets(s))
  }
  return def
}

export function useCharacterActions(notifyToast?: (msg: string) => void) {
  const currentAction = ref<ActionType>('idle')
  const currentStep = ref(0)
  const isPlaying = ref(true)
  const fps = ref(7)
  let animInterval: ReturnType<typeof setInterval> | null = null

  const actionDefinitions = reactive<Record<ActionType, ActionDefinitionItem>>(
    loadActionDefinitions()
  )

  function saveActionDefinitionsToStorage() {
    try {
      localStorage.setItem('nso_character_action_definitions_v1', JSON.stringify(actionDefinitions))
    } catch (err) {
      console.error('Failed to save action definitions:', err)
    }
  }

  watch(
    actionDefinitions,
    () => {
      saveActionDefinitionsToStorage()
    },
    { deep: true }
  )

  const currentActionDef = computed(() => actionDefinitions[currentAction.value])
  const currentStepCount = computed(() => currentActionDef.value?.steps.length || 1)
  const activeStepIndex = computed(() => {
    const count = currentStepCount.value
    if (count <= 0) return 0
    return currentStep.value % count
  })
  const currentStepData = computed<ActionStepItem | null>(() => {
    const steps = currentActionDef.value?.steps
    if (!steps || steps.length === 0) return null
    const item = steps[activeStepIndex.value] || steps[0] || null
    if (item) ensureStepPartOffsets(item)
    return item
  })

  // Export-compatible ActionSequence mapping for Unity export and baked spritesheet
  const actionSequences = computed<Record<ActionType, ActionSequence>>(() => {
    const result: any = {}
    const keys: ActionType[] = ['idle', 'walk', 'attack', 'jump']
    for (const k of keys) {
      const act = actionDefinitions[k]
      result[k] = {
        steps: act.steps.length,
        breathBob: act.steps.map((s: ActionStepItem) => s.breathBob),
        lungeX: act.steps.map((s: ActionStepItem) => s.lungeX),
        jumpY: act.steps.map((s: ActionStepItem) => s.jumpY),
        shadowScale: act.steps.map((s: ActionStepItem) => s.shadowScale),
        shadowOpacity: act.steps.map((s: ActionStepItem) => s.shadowOpacity),
        neckOffsets: act.steps.map((s: ActionStepItem) => s.neckOffset ?? 0),
        waistOffsets: act.steps.map((s: ActionStepItem) => s.waistOffset ?? 0),
        headOffsets: act.steps.map((s: ActionStepItem) => ({ ...(s.headOffset ?? { dx: 0, dy: 0 }) })),
        bodyOffsets: act.steps.map((s: ActionStepItem) => ({ ...(s.bodyOffset ?? { dx: 0, dy: 0 }) })),
        legOffsets: act.steps.map((s: ActionStepItem) => ({ ...(s.legOffset ?? { dx: 0, dy: 0 }) })),
        weaponOffsets: act.steps.map((s: ActionStepItem) => ({ ...s.weaponOffset })),
        zIndices: act.steps.map((s: ActionStepItem) => ({
          head: s.zIndices?.head ?? 1,
          body: s.zIndices?.body ?? 1,
          leg: s.zIndices?.leg ?? 1,
          weapon: s.zIndices?.weapon ?? 1,
          mask: s.zIndices?.mask ?? 1,
        })),
        getHeadFrame: (s: number) => act.steps[s % act.steps.length]?.headFrame ?? 0,
        getBodyFrame: (s: number) => act.steps[s % act.steps.length]?.bodyFrame ?? 1,
        getLegFrame: (s: number) => act.steps[s % act.steps.length]?.legFrame ?? 1,
        getWeaponFrame: (s: number) => act.steps[s % act.steps.length]?.weaponFrame ?? 1,
      }
    }
    return result
  })

  function showToast(msg: string) {
    if (notifyToast) notifyToast(msg)
  }

  function selectAction(act: ActionType) {
    currentAction.value = act
    currentStep.value = 0
  }

  function setStep(stepIdx: number) {
    currentStep.value = stepIdx
    isPlaying.value = false
  }

  function firstStep() {
    currentStep.value = 0
  }

  function lastStep() {
    currentStep.value = Math.max(0, currentStepCount.value - 1)
  }

  function prevStep() {
    const count = currentStepCount.value
    if (count <= 0) return
    currentStep.value = (currentStep.value - 1 + count) % count
  }

  function nextStep() {
    const count = currentStepCount.value
    if (count <= 0) return
    currentStep.value = (currentStep.value + 1) % count
  }

  function addActionStep() {
    const act = actionDefinitions[currentAction.value]
    const current = currentStepData.value
    const newIndex = act.steps.length + 1
    const newStep: ActionStepItem = {
      id: `${act.id}-${Date.now()}`,
      name: `Bước ${newIndex}`,
      headFrame: current ? current.headFrame : 0,
      bodyFrame: current ? current.bodyFrame : 1,
      legFrame: current ? current.legFrame : 1,
      weaponFrame: current ? current.weaponFrame : 1,
      lungeX: current ? current.lungeX : 0,
      jumpY: current ? current.jumpY : 0,
      breathBob: current ? current.breathBob : 0,
      neckOffset: current?.neckOffset ?? 0,
      waistOffset: current?.waistOffset ?? 0,
      headOffset: current?.headOffset ? { ...current.headOffset } : { dx: 0, dy: 0 },
      bodyOffset: current?.bodyOffset ? { ...current.bodyOffset } : { dx: 0, dy: 0 },
      legOffset: current?.legOffset ? { ...current.legOffset } : { dx: 0, dy: 0 },
      weaponOffset: current ? { ...current.weaponOffset } : { dx: 0, dy: 0, rot: 0 },
      shadowScale: current ? current.shadowScale : 1.0,
      shadowOpacity: current ? current.shadowOpacity : 0.75,
    }
    act.steps.splice(activeStepIndex.value + 1, 0, newStep)
    currentStep.value = activeStepIndex.value + 1
    showToast(`Đã thêm nhịp mới vào động tác ${actionLabels[currentAction.value]}`)
  }

  function duplicateActionStep() {
    const act = actionDefinitions[currentAction.value]
    const current = currentStepData.value
    if (!current) return
    const dup: ActionStepItem = {
      ...JSON.parse(JSON.stringify(current)),
      id: `${act.id}-${Date.now()}`,
      name: `${current.name} (Bản sao)`,
    }
    act.steps.splice(activeStepIndex.value + 1, 0, dup)
    currentStep.value = activeStepIndex.value + 1
    showToast(`Đã nhân bản nhịp ${activeStepIndex.value + 1}`)
  }

  function deleteActionStep() {
    const act = actionDefinitions[currentAction.value]
    if (act.steps.length <= 1) {
      showToast('Động tác cần ít nhất 1 nhịp!')
      return
    }
    const deletedIdx = activeStepIndex.value
    act.steps.splice(deletedIdx, 1)
    currentStep.value = Math.min(deletedIdx, act.steps.length - 1)
    showToast('Đã xóa nhịp hoạt ảnh')
  }

  function resetCurrentAction() {
    const defaultAct = defaultActionPresets[currentAction.value]
    actionDefinitions[currentAction.value] = JSON.parse(JSON.stringify(defaultAct))
    currentStep.value = 0
    showToast(`Đã đặt lại động tác ${actionLabels[currentAction.value]} về mặc định`)
  }

  function reorderActionStep(fromIndex: number, toIndex: number) {
    const act = actionDefinitions[currentAction.value]
    if (!act || !act.steps) return
    if (fromIndex < 0 || fromIndex >= act.steps.length || toIndex < 0 || toIndex >= act.steps.length) return
    if (fromIndex === toIndex) return

    isPlaying.value = false
    const [movedStep] = act.steps.splice(fromIndex, 1)
    act.steps.splice(toIndex, 0, movedStep)
    currentStep.value = toIndex
    showToast(`Đã chuyển Nhịp #${fromIndex + 1} sang vị trí #${toIndex + 1}`)
  }

  function resetAllActions() {
    for (const k of ['idle', 'walk', 'attack', 'jump'] as const) {
      actionDefinitions[k] = JSON.parse(JSON.stringify(defaultActionPresets[k]))
    }
    currentStep.value = 0
    showToast('Đã đặt lại toàn bộ 4 động tác về mặc định')
  }

  function changeStepPartFrame(
    category: CharacterCategory,
    delta: number,
    parts?: { head?: NsoPart; body?: NsoPart; leg?: NsoPart; weapon?: NsoPart }
  ) {
    const step = currentStepData.value
    if (!step) return
    if (category === 'head') {
      const max = parts?.head?.part?.length ? parts.head.part.length - 1 : 20
      step.headFrame = Math.max(0, Math.min(max, step.headFrame + delta))
    } else if (category === 'body') {
      const max = parts?.body?.part?.length ? parts.body.part.length - 1 : 30
      step.bodyFrame = Math.max(0, Math.min(max, step.bodyFrame + delta))
    } else if (category === 'leg') {
      const max = parts?.leg?.part?.length ? parts.leg.part.length - 1 : 20
      step.legFrame = Math.max(0, Math.min(max, step.legFrame + delta))
    } else if (category === 'weapon') {
      const max = parts?.weapon?.part?.length ? parts.weapon.part.length - 1 : 10
      step.weaponFrame = Math.max(0, Math.min(max, step.weaponFrame + delta))
    }
  }

  function setStepWeaponAngle(angle: number) {
    if (currentStepData.value) {
      currentStepData.value.weaponOffset.rot = angle
    }
  }

  function nudgeStepWeapon(dx: number, dy: number) {
    if (currentStepData.value) {
      currentStepData.value.weaponOffset.dx += dx
      currentStepData.value.weaponOffset.dy += dy
    }
  }

  function resetStepWeaponOffset() {
    if (currentStepData.value) {
      currentStepData.value.weaponOffset.dx = 0
      currentStepData.value.weaponOffset.dy = 0
      currentStepData.value.weaponOffset.rot = 0
    }
  }

  function nudgeStepJoint(joint: 'neck' | 'waist', delta: number, baseNeck = 20, baseWaist = 8) {
    if (!currentStepData.value) return
    ensureStepPartOffsets(currentStepData.value)
    if (joint === 'neck') {
      currentStepData.value.neckOffset = (currentStepData.value.neckOffset ?? 0) + delta
      showToast(
        `Khớp Cổ nhịp #${activeStepIndex.value + 1}: bù ${
          currentStepData.value.neckOffset > 0 ? '+' : ''
        }${currentStepData.value.neckOffset}px (Tổng ${baseNeck + currentStepData.value.neckOffset}px)`
      )
    } else {
      currentStepData.value.waistOffset = (currentStepData.value.waistOffset ?? 0) + delta
      showToast(
        `Khớp Eo nhịp #${activeStepIndex.value + 1}: bù ${
          currentStepData.value.waistOffset > 0 ? '+' : ''
        }${currentStepData.value.waistOffset}px (Tổng ${baseWaist + currentStepData.value.waistOffset}px)`
      )
    }
  }

  function resetStepJoint(joint: 'neck' | 'waist', baseNeck = 20, baseWaist = 8) {
    if (!currentStepData.value) return
    ensureStepPartOffsets(currentStepData.value)
    if (joint === 'neck') {
      currentStepData.value.neckOffset = 0
      showToast(`Khớp Cổ nhịp #${activeStepIndex.value + 1} về chuẩn gốc (${baseNeck}px)`)
    } else {
      currentStepData.value.waistOffset = 0
      showToast(`Khớp Eo nhịp #${activeStepIndex.value + 1} về chuẩn gốc (${baseWaist}px)`)
    }
  }

  function nudgeStepPart(category: CharacterCategory, deltaX: number, deltaY: number, mult = 1) {
    if (!currentStepData.value) return
    ensureStepPartOffsets(currentStepData.value)
    const dx = deltaX * mult
    const dy = deltaY * mult
    const s = currentStepData.value
    if (category === 'head') {
      s.headOffset!.dx += dx
      s.headOffset!.dy += dy
      showToast(`[ĐẦU nhịp #${activeStepIndex.value + 1}] dx: ${s.headOffset!.dx}, dy: ${s.headOffset!.dy}`)
    } else if (category === 'body') {
      s.bodyOffset!.dx += dx
      s.bodyOffset!.dy += dy
      showToast(`[THÂN nhịp #${activeStepIndex.value + 1}] dx: ${s.bodyOffset!.dx}, dy: ${s.bodyOffset!.dy}`)
    } else if (category === 'leg') {
      s.legOffset!.dx += dx
      s.legOffset!.dy += dy
      showToast(`[CHÂN nhịp #${activeStepIndex.value + 1}] dx: ${s.legOffset!.dx}, dy: ${s.legOffset!.dy}`)
    } else if (category === 'weapon') {
      s.weaponOffset.dx += dx
      s.weaponOffset.dy += dy
      showToast(`[VŨ KHÍ nhịp #${activeStepIndex.value + 1}] dx: ${s.weaponOffset.dx}, dy: ${s.weaponOffset.dy}`)
    }
  }

  function resetStepPartOffset(category: CharacterCategory) {
    if (!currentStepData.value) return
    ensureStepPartOffsets(currentStepData.value)
    const s = currentStepData.value
    if (category === 'head') {
      s.headOffset = { dx: 0, dy: 0 }
    } else if (category === 'body') {
      s.bodyOffset = { dx: 0, dy: 0 }
    } else if (category === 'leg') {
      s.legOffset = { dx: 0, dy: 0 }
    } else if (category === 'weapon') {
      s.weaponOffset.dx = 0
      s.weaponOffset.dy = 0
    }
    showToast(`Đã đặt lại vị trí ${category.toUpperCase()} ở nhịp này về (0, 0)`)
  }

  function setStepPartZIndex(category: CharacterCategory | 'mask', z: number) {
    if (!currentStepData.value) return
    ensureStepPartOffsets(currentStepData.value)
    if (!currentStepData.value.zIndices) {
      currentStepData.value.zIndices = { head: 1, body: 1, leg: 1, weapon: 1, mask: 1 }
    }
    currentStepData.value.zIndices[category] = z
    showToast(`Lớp hiển thị (${category.toUpperCase()}) nhịp #${activeStepIndex.value + 1}: z-index = ${z}`)
  }

  function nudgeStepPartZIndex(category: CharacterCategory | 'mask', delta: number) {
    if (!currentStepData.value) return
    ensureStepPartOffsets(currentStepData.value)
    if (!currentStepData.value.zIndices) {
      currentStepData.value.zIndices = { head: 1, body: 1, leg: 1, weapon: 1, mask: 1 }
    }
    const cur = currentStepData.value.zIndices[category] ?? 1
    const next = cur + delta
    currentStepData.value.zIndices[category] = next
    showToast(`Lớp hiển thị (${category.toUpperCase()}) nhịp #${activeStepIndex.value + 1}: z-index = ${next}`)
  }

  function resetStepPartZIndex(category: CharacterCategory | 'mask') {
    if (!currentStepData.value) return
    ensureStepPartOffsets(currentStepData.value)
    if (!currentStepData.value.zIndices) {
      currentStepData.value.zIndices = { head: 1, body: 1, leg: 1, weapon: 1, mask: 1 }
    }
    currentStepData.value.zIndices[category] = 1
    showToast(`Đã đặt lại z-index (${category.toUpperCase()}) về mặc định (1)`)
  }

  function getStepOffsetForCategory(cat: CharacterCategory) {
    if (!currentStepData.value) return { dx: 0, dy: 0 }
    ensureStepPartOffsets(currentStepData.value)
    const s = currentStepData.value
    if (cat === 'head') return s.headOffset!
    if (cat === 'body') return s.bodyOffset!
    if (cat === 'leg') return s.legOffset!
    return { dx: s.weaponOffset.dx, dy: s.weaponOffset.dy }
  }

  function stepAnimation() {
    if (!isPlaying.value) return
    const total = currentStepCount.value || 4
    currentStep.value = (currentStep.value + 1) % total
  }

  function startAnimationTimer() {
    if (animInterval) clearInterval(animInterval)
    animInterval = setInterval(stepAnimation, 1000 / fps.value)
  }

  function stopAnimationTimer() {
    if (animInterval) {
      clearInterval(animInterval)
      animInterval = null
    }
  }

  function togglePlay() {
    isPlaying.value = !isPlaying.value
  }

  function pauseAnimation() {
    isPlaying.value = false
  }

  watch(fps, () => {
    if (isPlaying.value) startAnimationTimer()
  })

  return {
    currentAction,
    currentStep,
    isPlaying,
    fps,
    actionDefinitions,
    currentActionDef,
    currentStepCount,
    activeStepIndex,
    currentStepData,
    actionSequences,
    selectAction,
    setStep,
    firstStep,
    lastStep,
    prevStep,
    nextStep,
    addActionStep,
    duplicateActionStep,
    deleteActionStep,
    reorderActionStep,
    resetCurrentAction,
    resetAllActions,
    changeStepPartFrame,
    setStepWeaponAngle,
    nudgeStepWeapon,
    resetStepWeaponOffset,
    nudgeStepJoint,
    resetStepJoint,
    nudgeStepPart,
    resetStepPartOffset,
    setStepPartZIndex,
    nudgeStepPartZIndex,
    resetStepPartZIndex,
    getStepOffsetForCategory,
    startAnimationTimer,
    stopAnimationTimer,
    togglePlay,
    pauseAnimation,
  }
}
