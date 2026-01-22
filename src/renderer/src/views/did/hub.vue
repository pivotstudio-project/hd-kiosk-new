<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const { ipcRenderer } = window.electron

const allPages: any = ref([])
const groupB = computed(() => allPages.value.filter((page: any) => page.group === 'B'))

const openLink = (pageId: string, pageName: string): void => {
  if (pageId) {
    router.push({ name: 'webview', query: { id: pageId, name: pageName, type: 'did' } })
  } else {
    console.error('페이지 ID가 없어 이동할 수 없습니다.')
  }
}

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

onMounted(async () => {
  // 데이터를 받아오는 동안 템플릿에서 groupB[0].label을 읽으려 하면 
  // TypeError가 발생해 화면이 하얗게 멈춥니다.
  const config = await ipcRenderer.invoke('get-page-config')
  allPages.value = config || []
  
  window.api?.setIdleTimeout?.(30 * 2000)
})
</script>

<template>
  <section class="page-did-hub">
    <button class="quit-button" @click="quitApp">앱 종료</button>
    <img class="logo" src="/logo01.png" />
    
    <div v-if="groupB && groupB.length > 0" class="page-did-hub__contents">
      <h1>{{ groupB[0]?.label }}</h1>
      <p>현대자동차의 특별하고 스마트한<br />월별 구매혜택/차종별 구매혜택</p>
      <button @click="openLink(groupB[0]?.id, groupB[0]?.pageName)">자세히 보기</button>
    </div>
  </section>
</template>

<style scoped>
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