import { createRouter, createWebHashHistory } from 'vue-router'

// 설정 페이지
import SettingsView from '../views/Settings.vue'

// 브라우저 뷰 전용 페이지
import webView from '../views/webView.vue'

// EV SCREEN 페이지
import evMain from '../views/ev-screen/index.vue'
import evHub from '../views/ev-screen/hub.vue'

// DID 페이지
import didMain from '../views/did/index.vue'
import didHub from '../views/did/hub.vue'

// STAND BY ME 페이지
import stbMain from '../views/stand-by-me/index.vue'

const routes = [
  // 1. 최초 진입 및 설정 화면
  {
    path: '/',
    name: 'settings',
    component: SettingsView
  },

  // 2. EV Screen 프로그램 관련 화면
  {
    path: '/ev-screen',
    name: 'ev-main',
    component: evMain
  },
  {
    path: '/ev-screen/hub',
    name: 'ev-hub',
    component: evHub
  },

  // 3. DID 프로그램 관련 화면
  {
    path: '/did',
    name: 'did-main',
    component: didMain
  },
  {
    path: '/did/hub',
    name: 'did-hub',
    component: didHub
  },

  // 4. Stand By Me 프로그램 관련 화면
  {
    path: '/stand-by-me',
    name: 'stb-main',
    component: stbMain
  },

  // 5. 공통 웹뷰 화면
  {
    path: '/webview',
    name: 'webview',
    component: webView
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// ▼▼▼ [핵심 추가] 2단계: 자동 분기 로직 ▼▼▼
router.beforeEach(async (to, from, next) => {
  // 1. 앱이 실행되고 처음으로 루트('/') 경로, 즉 세팅 화면에 진입하려 할 때만 검사
  if (to.path === '/' && from.matched.length === 0) {
    try {
      const { ipcRenderer } = window.electron || {}
      
      if (ipcRenderer) {
        // Main Process에 저장된 키오스크 정보(kiosk.json)를 요청
        const info = await ipcRenderer.invoke('get-kiosk-info')
        
        // 2. 만약 저장된 모드(mode)와 이름(name)이 있다면?
        if (info && info.mode && info.name) {
          console.log(`[Router] 저장된 설정 발견: ${info.mode}. 자동 이동합니다.`)
          
          // 저장된 모드 경로로 강제 이동 (예: '/ev-screen' 또는 '/did')
          // 주의: info.mode 값은 route path와 일치해야 합니다. ('ev-screen', 'did', 'stand-by-me')
          return next(`/${info.mode}`)
        }
      }
    } catch (error) {
      console.error('[Router] 키오스크 정보 로드 실패:', error)
    }
  }
  
  // 3. 저장된 정보가 없으면 원래대로 설정(SettingsView) 화면으로 이동
  next()
})

export default router