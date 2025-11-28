<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKioskStore } from './stores/kiosk'
import UpdateModal from './components/UpdateModal.vue'

// Electron IPC 사용 (초기화 명령 전송용)
const { ipcRenderer } = window.electron || window.require?.('electron') || {}

const router = useRouter()
const kioskStore = useKioskStore()

// --- [추가] 히든 초기화 버튼 로직 ---
const clickCount = ref(0)
const clickTimer = ref<any>(null)

function handleSecretClick() {
  clickCount.value++
  console.log(`Secret Click: ${clickCount.value}`)

  // 3초 내에 연속 클릭하지 않으면 카운트 리셋 (타이머)
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
  const confirmMsg = '관리자 모드: 키오스크 설정을 초기화하시겠습니까?\n(앱이 재시작됩니다)'
  
  if (confirm(confirmMsg)) {
    try {
      // Main Process에 초기화 요청
      await ipcRenderer.invoke('reset-kiosk-info')
      alert('초기화되었습니다. 설정 화면으로 돌아갑니다.')
      
      // 앱을 새로고침하여 라우터 가드(분기 처리)부터 다시 시작
      router.replace('/')
    } catch (e) {
      console.error('Reset failed:', e)
      alert('초기화 중 오류가 발생했습니다.')
    }
  }
}

// --- 기존 로직 ---
onMounted(() => {
  // 터치 키보드 숨기기
  window.api?.hideTouchKeyboard()

  // 홈으로 돌아가기 이벤트
  window.api?.onGoHome(async () => {
    window.api?.hideTouchKeyboard()
    
    // 현재 모드에 맞춰서 홈 경로 결정
    switch (kioskStore.currentMode) {
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
        // 모드가 없으면(초기화 상태 등) 설정 화면으로 갈 수도 있음
        // router.replace('/') 
        break
    }
  })

  // (참고) 기존의 Auto Updater alert 코드는 제거했습니다.
  // 이유: <UpdateModal /> 컴포넌트가 더 예쁜 UI로 처리해주기 때문입니다.
})
</script>

<template>
  <div class="app-root">
    <router-view />
    
    <UpdateModal />

    <div class="secret-trigger" @pointerdown="handleSecretClick"></div>
  </div>
</template>

<style>
/* [필수] 전체 화면 레이아웃 잡기 */
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
  position: relative; /* 자식 absolute 배치를 위해 */
}

/* 히든 버튼 스타일 */
.secret-trigger {
  position: fixed;
  top: 0;
  right: 0;
  width: 100px; /* 터치 영역 크기 조절 가능 */
  height: 100px;
  z-index: 999999; /* 모든 UI보다 위에 있어야 함 */
  cursor: default; /* 마우스 커서가 바뀌지 않게 하여 은폐 */
  
  /* 👇 테스트할 때만 아래 주석을 풀어서 빨간색으로 위치를 확인하세요 */
  /* background-color: rgba(255, 0, 0, 0.3); */
}
</style>