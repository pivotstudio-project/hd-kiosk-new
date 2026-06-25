<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKioskStore } from './stores/kiosk'
import UpdateModal from './components/UpdateModal.vue'

// Electron IPC 로드
const { ipcRenderer } = window.electron || window.require?.('electron') || {}

const router = useRouter()
const kioskStore = useKioskStore()

// --- 히든 초기화 버튼 로직 ---
const clickCount = ref(0)
const clickTimer = ref<any>(null)

function handleSecretClick() {
  clickCount.value++
  console.log(`Secret Click: ${clickCount.value}`)

  // 3초 내에 연속 클릭하지 않으면 카운트 리셋
  if (clickTimer.value) clearTimeout(clickTimer.value)
  clickTimer.value = setTimeout(() => {
    clickCount.value = 0
  }, 3000)

  // 5번 연속 클릭 시 동작
  if (clickCount.value >= 5) {
    clickCount.value = 0
    runResetProcess()
  }
}

async function runResetProcess() {
  const confirmMsg = '키오스크 설정을 초기화하시겠습니까?\n(앱이 재시작됩니다.)'
  
  if (confirm(confirmMsg)) {
    try {
      // Main Process에 초기화 요청
      await ipcRenderer.invoke('reset-kiosk-info')
      alert('초기화되었습니다. 설정 화면으로 돌아갑니다.')
      
      // 앱을 새로고침하여 라우터 가드부터 다시 시작
      window.location.reload()
    } catch (e) {
      console.error('Reset failed:', e)
      alert('초기화 중 오류가 발생했습니다.')
    }
  }
}

// --- 앱 시작 및 이벤트 로직 ---
onMounted(async () => {
  // 1. 터치 키보드 숨기기
  window.api?.hideTouchKeyboard()

  // 2-0. [개발 전용] VITE_KIOSK_MODE가 주입되면 kiosk.json 대신 env 값으로 스토어를 채운다.
  //       (뒤로가기/홈으로 분기가 currentMode에 의존하므로 반드시 설정 필요)
  const devForcedMode = import.meta.env.VITE_KIOSK_MODE
  if (import.meta.env.DEV && devForcedMode && !kioskStore.currentMode) {
    kioskStore.setMode(devForcedMode)
    kioskStore.setKioskName('dev')
  }

  // 2. [핵심 수정] 앱 실행 시 Pinia Store가 비어있다면, 파일(kiosk.json)에서 읽어와 동기화
  if (!kioskStore.currentMode) {
    try {
      const info = await ipcRenderer.invoke('get-kiosk-info')
      if (info && info.mode) {
        console.log('[App] 저장된 키오스크 정보 복구:', info)
        kioskStore.setKioskName(info.name)
        kioskStore.setMode(info.mode)
      }
    } catch (e) {
      console.error('키오스크 정보 로드 실패:', e)
    }
  }

  // 3. 홈으로 돌아가기 이벤트 (이제 Store에 값이 있으므로 정상 동작함)
  window.api?.onGoHome(() => {
    window.api?.hideTouchKeyboard()
    
    const mode = kioskStore.currentMode
    console.log('[App] Go Home 요청됨. 타겟 모드:', mode)

    switch (mode) {
      case 'ev-screen':
        router.replace('/ev-screen')
        break
      case 'did':
        router.replace('/did')
        break
      case 'stand-by-me':
        router.replace('/stand-by-me')
        break
      default:
        console.warn('[App] 모드 정보 없음. 설정 화면으로 이동합니다.')
        router.replace('/') 
        break
    }
  })
})
</script>

<template>
  <div class="app-root">
    <router-view />
    
    <UpdateModal />

    <div class="secret-trigger" @click="handleSecretClick"></div>
  </div>
</template>

<style>
/* 전체 화면 레이아웃 잡기 */
html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden; /* 스크롤 방지 */
}

.app-root {
  width: 100%;
  height: 100%;
  position: relative;
}

/* 히든 버튼 스타일 */
.secret-trigger {
  position: fixed;
  top: 0;
  right: 0; /* 우측 상단 */
  width: 100px;
  height: 100px;
  z-index: 999999; /* 모든 UI보다 위에 */
  cursor: default; /* 마우스 커서 숨김 효과 */
  
  /* 👇 테스트할 때만 주석 해제하여 빨간 박스로 위치 확인 */
  /* background-color: rgba(255, 0, 0, 0.3); */
}
</style>