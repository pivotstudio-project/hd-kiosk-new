<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const { ipcRenderer } = window.electron

const allPages: any = ref([])
const groupB = computed(() => allPages.value.filter((page) => page.group === 'B'))

/**
 * 버튼 클릭 시 id를 받아 webview 페이지로 이동합니다.
 * @param pageId 이동할 페이지의 고유 ID
 */
const openLink = (pageId: string, pageName: string): void => {
  // pageId가 유효한지 간단히 확인합니다.
  if (pageId) {
    // 라우터를 통해 새로운 페이지로 이동하고, 쿼리 파라미터로 'id'를 전달합니다.
    router.push({ name: 'webview', query: { id: pageId, name: pageName } })
  } else {
    console.error('페이지 ID가 없어 이동할 수 없습니다.')
  }
}

/**
 * 앱 종료 이벤트 (Vue에서만 처리)
 */
const quitApp = async (): Promise<void> => {
  try {
    // Main Process에 확인창 요청
    const shouldQuit = await ipcRenderer.invoke('confirm-before-quit')

    if (shouldQuit) {
      console.log('사용자가 종료를 확인함.')
      // before-quit 이벤트를 우회하고 직접 종료
      ipcRenderer.send('force-quit')
    } else {
      console.log('사용자가 종료를 취소함.')
    }
  } catch (error) {
    console.error('종료 처리 중 오류:', error)
  }
}

onMounted(async () => {
  allPages.value = await ipcRenderer.invoke('get-page-config')
  window.api?.setIdleTimeout?.(30 * 1000)
})
</script>

<template>
  <section class="page-did-hub">
    <button class="quit-button" @click="quitApp">앱 종료</button>
    <img class="logo" src="/logo01.png" />
    <div class="page-did-hub__contents">
        <h1>{{ groupB[0].label }}</h1>
        <p>현대자동차의 특별하고 스마트한<br />월별 구매혜택/차종별 구매혜택</p>
        <button @click="openLink(groupB[0].id, groupB[0].pageName)">자세히 보기</button>
      </div>
    <!-- <template v-for="item in groupB" :key="item.id">
      <div class="page-did-hub__contents" :class="{ gray: item.id === 'save' }">
        <h1>{{ item.label }}</h1>
        <template v-if="item.id === 'benefit'">
          <p>현대자동차의 특별하고 스마트한<br />월별 구매혜택/차종별 구매혜택</p>
        </template>
        <template v-else>
          <p>이달만의 특별한 현대자동차의 구매혜택</p>
        </template>
        <button @click="openLink(item.id, item.pageName)">자세히 보기</button>
      </div>
    </template> -->
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
