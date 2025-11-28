<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKioskStore } from '../stores/kiosk'

const { ipcRenderer } = window.electron || window.require?.('electron') || {}

const router = useRouter()
const kioskStore = useKioskStore()
const inputName = ref('')

// [핵심] 빌드 시점에 주입된 모드 확인 ('ev-screen' 또는 'did')
// npm run dev로 켤 때는 이 값이 undefined 입니다.
const buildMode = import.meta.env.VITE_KIOSK_MODE

// 화면 타이틀을 모드에 따라 다르게 표시
const pageTitle = computed(() => {
  if (buildMode === 'ev-screen') return 'EV Screen 초기 설정'
  if (buildMode === 'did') return 'DID 초기 설정'
  return '키오스크 통합 설정 (개발 모드)'
})

// 앱 시작 시 저장된 이름 불러오기 (편의성)
onMounted(async () => {
  window.api?.send('stop-idle-timer')

  try {
    const data = await ipcRenderer.invoke('get-kiosk-info')
    if (data && data.name) {
      inputName.value = data.name
    }
  } catch (error) {
    console.error('Failed to load kiosk info:', error)
  }
})

// [키보드 처리] 입력창 터치 시 화상 키보드 호출
onMounted(() => {
  window.api?.hideTouchKeyboard()
  const inputEl = document.getElementById('kiosk-name')
  if (inputEl) {
    inputEl.addEventListener('pointerdown', () => {
      console.log('입력 필드 포커스 감지')
      window.api?.showTouchKeyboard()
    })
  }
})

// 저장 및 시작 함수
async function saveAndStart(manualMode?: string) {
  if (inputName.value.trim() === '') {
    alert('키오스크 이름을 입력하세요')
    return
  }

  // 빌드 모드가 있으면 그걸 따르고, 없으면(개발중) 파라미터로 받은 값을 씀
  const modeToSet = buildMode || manualMode || 'ev-screen'
  const nameToSet = inputName.value.trim()

  window.api?.hideTouchKeyboard()

  try {
    // 1. Pinia 상태 저장
    kioskStore.setKioskName(nameToSet)
    kioskStore.setMode(modeToSet)

    // 2. Electron 파일 저장 (kiosk.json)
    await ipcRenderer.invoke('set-kiosk-info', {
      name: nameToSet,
      mode: modeToSet
    })

    window.api?.send('start-idle-timer')

    // 3. 해당 모드 페이지로 이동
    router.replace(`/${modeToSet}`)

  } catch (error) {
    console.error('Failed to set kiosk mode:', error)
    alert('설정 저장 중 오류가 발생했습니다.')
  }
}
</script>

<template>
  <div class="page-settings">
    <div class="page-settings__wrapper">
      <h1 class="page-settings__title">{{ pageTitle }}</h1>

      <div class="page-settings__group">
        <label for="kiosk-name">키오스크 이름을 입력하세요</label>
        <input 
          id="kiosk-name" 
          v-model="inputName" 
          type="text" 
          placeholder="예: 강남대로점" 
          @keydown.enter="() => saveAndStart()"
        />
      </div>

      <p class="page-settings__text">
        <span v-if="buildMode">설정을 완료하면 프로그램이 시작됩니다.</span>
        <span v-else>개발 모드입니다. 실행할 프로그램을 선택하세요.</span>
      </p>

      <div v-if="buildMode" class="page-settings__btn-group">
        <button class="btn-primary" @click="() => saveAndStart()">
          설정 완료 및 시작
        </button>
      </div>

      <div v-else class="page-settings__btn-group">
        <button @click="saveAndStart('ev-screen')">EV Screen (Dev)</button>
        <button @click="saveAndStart('did')">DID (Dev)</button>
      </div>

      </div>
  </div>
</template>

<style scoped>
/* [추가] 메인 액션 버튼 스타일 */
.btn-primary {
  width: 100%;
  background-color: #002c5f !important; /* 현대 블루 */
  color: white;
  font-weight: bold;
}
</style>