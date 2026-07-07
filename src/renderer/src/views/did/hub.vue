<script setup lang="ts">
import { onMounted } from 'vue'
import DidBenefitBlocks from '../../components/DidBenefitBlocks.vue'

const { ipcRenderer } = window.electron

const quitApp = async (): Promise<void> => {
  try {
    const shouldQuit = await ipcRenderer.invoke('confirm-before-quit')
    if (shouldQuit) {
      ipcRenderer.send('force-quit')
    }
  } catch (error) {
    console.error('종료 처리 중 오류:', error)
  }
}

onMounted(() => {
  window.api?.setIdleTimeout?.(30 * 2000)
})
</script>

<template>
  <div class="did-hub-wrap">
    <button class="quit-button" @click="quitApp">앱 종료</button>
    <!-- 인트로 마지막 슬라이드와 동일한 구매혜택 2블록 (공용 컴포넌트) -->
    <DidBenefitBlocks />
  </div>
</template>

<style scoped>
.did-hub-wrap {
  position: relative;
  height: 100vh;
}

.quit-button {
  position: absolute;
  bottom: 0;
  left: 0;
  z-index: 10;
  width: 100px;
  height: 100px;
  opacity: 0;
}
</style>
