<script setup lang="ts">
// 기존 import 및 setup 유지
import { ref, computed, onBeforeMount } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const { ipcRenderer } = window.electron

const isLoading = ref(true)
const allPages: any = ref([])
const groupA = computed(() => allPages.value.filter((page) => page.group === 'A'))

// 3 / 3 / 4 로 분할
const splitIntoRows = (items: any[], pattern: number[]) => {
  const result: any = []
  let index = 0
  for (const count of pattern) {
    result.push(items.slice(index, index + count))
    index += count
  }
  return result
}

// 페이지 이동
const openLink = (pageId: string, pageName: string): void => {
  if (pageId) {
    router.push({ name: 'webview', query: { id: pageId, name: pageName, type: 'ev' } })
  } else {
    console.error('페이지 ID가 없어 이동할 수 없습니다.')
  }
}

// The all-new TUCSON 버튼 → 투싼 인트로 페이지로 이동
const openTucson = (): void => {
  router.push({ name: 'webview', query: { id: 'tucson', name: 'The all-new TUCSON', type: 'ev' } })
}

// The all-new AVANTE 버튼 → 아반떼 인트로 페이지로 이동
const openAvante = (): void => {
  router.push({ name: 'webview', query: { id: 'avante', name: 'The all-new AVANTE', type: 'ev' } })
}

// 종료 처리
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

onBeforeMount(async () => {
  allPages.value = await ipcRenderer.invoke('get-page-config')

  if (allPages.value) {
    isLoading.value = false
  }
  window.api?.setIdleTimeout?.(30 * 2000)
})
</script>

<template>
  <section v-if="!isLoading" class="page-hub page-hub--bg">
    <button class="quit-button" @click="quitApp">앱 종료</button>

    <div class="page-hub__contents">
      <h1 class="page-hub__title">Mobility EX Zone</h1>

      <div class="page-hub__btn-group">
        <div
          v-for="(row, rowIndex) in splitIntoRows(groupA, [2, 4, 4])"
          :key="'row-' + rowIndex"
          class="btn-row"
        >
          <template v-for="item in row" :key="item.id">
            <!-- '내 차 추천받기'(explorer) 앞에 신차 강조 버튼: TUCSON → AVANTE 순 -->
            <template v-if="item.id === 'explorer'">
              <button class="btn-feature" @click="openTucson">The all-new TUCSON</button>
              <button class="btn-feature" @click="openAvante">The all-new AVANTE</button>
            </template>

            <button @click="openLink(item.id, item.pageName)">
              <span v-html="item.label"></span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.quit-button {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
  width: 100px;
  height: 100px;
  opacity: 0;
}

.btn-row {
  display: flex;
  justify-content: center;
  column-gap: 4vw;
}
</style>
