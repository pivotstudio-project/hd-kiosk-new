<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKioskStore } from '../stores/kiosk'
import axios from 'axios'

/* -----------------------------
 * 전역/스토어/라우터 설정
 * ----------------------------- */
const { ipcRenderer } = window.electron || window.require?.('electron') || {}
const route = useRoute()
const router = useRouter()
const kioskStore = useKioskStore()

const pageId = route.query.id as string
const pageName = route.query.name as string
const url = route.query.url as string

/* -----------------------------
 * 상태값
 * ----------------------------- */
const loading = ref(true)
const canGoBack = ref(false)
const startTime = ref<number>(0)
const currentUrl = ref<string>('')
const initialCatalogUrl = ref<string>('')
let hasExited = false

/* -----------------------------
 * 공통 데이터 (API 호출용)
 * ----------------------------- */
const commonInfo = {
  kioskName: kioskStore.kioskName,
  device: kioskStore.currentMode,
  pageName: pageName,
  url: pageId
}

/* -----------------------------
 * WebView 제어
 * ----------------------------- */
const CATALOG_URLS = [
  'https://www.hyundai.com/kr/ko/e/vehicles/catalog-price-download',
  'https://www.hyundai.com/kr/ko/c/purchase-guid/catalog'
]

const updateCanGoBack = async (): Promise<void> => {
  if (ipcRenderer && pageId) {
    canGoBack.value = await ipcRenderer.invoke('webview-can-go-back', pageId)
  }
}

const goBack = async (): Promise<void> => {
  window.api?.hideTouchKeyboard?.()

  // catalog 페이지 분기 처리
  if (pageId === 'catalog') {
    // Adobe 페이지 → catalog 초기 URL로 복귀
    if (currentUrl.value.startsWith('https://indd.adobe.com/view') && initialCatalogUrl.value) {
      ipcRenderer.send('webview-load-url', {
        id: pageId,
        url: initialCatalogUrl.value
      })
      console.log(`[catalog] Adobe 페이지에서 초기 catalog URL로 복귀`)
      return
    }

    // 초기 catalog URL이라면 → 선택화면 이동
    if (currentUrl.value === initialCatalogUrl.value) {
      console.log(`[catalog] 초기 catalog URL이므로 hub로 이동`)
      router.replace('/ev-screen/hub')
      return
    }
  }

  // 일반적인 뒤로가기
  if (canGoBack.value && ipcRenderer) {
    ipcRenderer.send('webview-control', { action: 'back', id: pageId })
    return
  }

  // fallback
  await handleExitLogic()
  switch (kioskStore.currentMode) {
    case 'ev-screen':
      router.replace('/ev-screen/hub')
      break
    case 'did':
      router.replace('/did/hub')
      break
    case 'stand-by-me':
      router.replace('/stand-by-me')
      break
  }
}

const goHome = async (): Promise<void> => {
  try {
    window.api?.hideTouchKeyboard?.()
    await handleExitLogic()

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
  } catch (error) {
    console.error('웹뷰 초기화 실패:', error)
  }
}

/* -----------------------------
 * API 호출 (방문/체류 시간 기록)
 * ----------------------------- */
const recordVisitCount = async (): Promise<void> => {
  try {
    const { data } = await axios.post('https://www.pivotstudio.co.kr/api/hyundai/visit', {
      ...commonInfo
    })
    console.log(`[${pageId}] 방문 기록 성공`, data)
  } catch (err) {
    console.error(`[${pageId}] 방문 기록 실패`, err)
  }
}

const handleExitLogic = async (): Promise<void> => {
  if (hasExited) return
  hasExited = true

  const stayTimeInSeconds = ((Date.now() - startTime.value) / 1000).toFixed(2)
  const stayData = {
    ...commonInfo,
    stayDuration: Number(parseFloat(stayTimeInSeconds).toFixed(2))
  }

  try {
    const { data } = await axios.post('https://www.pivotstudio.co.kr/api/hyundai/visit', stayData)
    console.log(`[${url}] 체류 기록 성공`, data)
  } catch (err) {
    console.error(`[${url}] 체류 기록 실패`, err)
  }
}

/* -----------------------------
 * 라이프사이클
 * ----------------------------- */
onMounted(async () => {
  hasExited = false
  startTime.value = Date.now()
  recordVisitCount()

  if (!ipcRenderer || !pageId) {
    console.error('IPC Renderer 또는 Page ID를 사용할 수 없습니다.')
    goHome()
    return
  }

  // Webview show 요청 (가장 먼저 실행)
  ipcRenderer.send('manage-webview', { action: 'show', id: pageId })

  const isCatalogTabUrl = (url: string): boolean => {
    return CATALOG_URLS.some((catalogUrl) => url.startsWith(catalogUrl))
  }

  ipcRenderer.on('webview-url-changed', (_, { id, url }: { id: string; url: string }) => {
    if (id !== pageId || !url) return

    currentUrl.value = url

    if (pageId === 'catalog' && isCatalogTabUrl(url)) {
      // 아직 initialCatalogUrl이 두 탭 중 하나가 아니라면 → 저장
      if (!CATALOG_URLS.includes(initialCatalogUrl.value)) {
        initialCatalogUrl.value = url
        console.log(`[catalog] 초기 catalog 탭 URL 저장됨:`, url)
      }

      // initialCatalogUrl이 기존 탭 A인데, 사용자가 탭 B로 이동 → 업데이트
      if (
        CATALOG_URLS.includes(initialCatalogUrl.value) &&
        initialCatalogUrl.value !== url &&
        isCatalogTabUrl(url)
      ) {
        initialCatalogUrl.value = url
        console.log(`[catalog] 다른 탭으로 이동함 → 초기 URL 업데이트:`, url)
      }
    }
  })

  // 로딩 상태 수신
  ipcRenderer.on('loading-status', (_, status: boolean) => {
    loading.value = status
  })

  // canGoBack 감지 주기 실행
  const interval = setInterval(updateCanGoBack, 300)
  onUnmounted(() => clearInterval(interval))
})

onUnmounted(() => {
  handleExitLogic()
  if (ipcRenderer && pageId) {
    ipcRenderer.send('manage-webview', { action: 'hide', id: pageId })
    ipcRenderer.removeAllListeners('loading-status')
    ipcRenderer.removeAllListeners('webview-url-changed')
  }
})

watch(currentUrl, (url) => {
  if (url === 'about:blank' || !url || url === '') {
    // 로딩 중이 아닐 때만 이동 (무한 루프 방지)
    if (!loading.value) {
      switch (kioskStore.currentMode) {
        case 'ev-screen':
          router.replace('/ev-screen/hub')
          break
        case 'did':
          router.replace('/did/hub')
          break
      }
    }
    return
  }

  // 특정 URL 조건
  const extendTimeout =
    url.startsWith('https://indd.adobe.com/view') ||
    url.startsWith('https://www.hyundai.com/contents')

  if (extendTimeout) {
    // 30분으로 연장
    window.api?.setIdleTimeout?.(30 * 60 * 1000)
    console.log('IDLE_TIMEOUT 연장: 5분')
  } else {
    // 기본값 60초로 초기화
    window.api?.setIdleTimeout?.(60 * 1000)
  }
})
</script>

<template>
  <div class="page-webview">
    <!-- 로딩 -->
    <div
      v-if="loading"
      class="page-webview__loading"
      :class="{ 'did-mode': kioskStore.currentMode === 'did' }"
    >
      <div class="spinner"></div>
      <p>페이지 연결 중 입니다.</p>
    </div>

    <!-- 컨트롤러 -->
    <div class="page-webview__controller" :class="{ 'did-mode': kioskStore.currentMode === 'did' }">
      <button class="page-webview__btn" @click="goBack">
        {{ canGoBack ? '뒤로가기' : '선택화면' }}
      </button>

      <button class="page-webview__btn" @click="goHome">홈으로</button>
    </div>
  </div>
</template>

<style scoped>
.spinner {
  border: 8px solid #ddd;
  border-top: 8px solid #002c5f;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  animation: spin 1.5s linear infinite;
}

p {
  margin-top: 20px;
  font-size: 1.2em;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
