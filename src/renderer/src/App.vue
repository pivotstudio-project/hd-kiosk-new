<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKioskStore } from './stores/kiosk'

const router = useRouter()
const kioskStore = useKioskStore()

onMounted(() => {
  // 터치 키보드 숨기기
  window.api?.hideTouchKeyboard()

  // 홈으로 돌아가기 이벤트
  window.api?.onGoHome(async () => {
    window.api?.hideTouchKeyboard()
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
    }
  })

  // ===========================
  // Auto Updater 이벤트 처리
  // ===========================
  window.api?.onUpdateAvailable(() => {
    alert('업데이트 내역이 있습니다. 다운로드가 진행됩니다.')
  })

  window.api?.onUpdateDownloaded(() => {
    alert('업데이트 다운로드 완료. 앱 재시작됩니다.')
    window.api?.send('quit-and-install')
  })
})
</script>

<template>
  <router-view />
</template>
