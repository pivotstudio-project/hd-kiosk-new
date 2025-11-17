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
  // :url 자리에 표시할 웹사이트 주소를 동적으로 전달받습니다.
  {
    path: '/webview',
    name: 'webview',
    component: webView
  }
]

const router = createRouter({
  history: createWebHashHistory(), // Electron에서는 Hash 모드를 사용하는 것이 간단합니다.
  routes
})

export default router
