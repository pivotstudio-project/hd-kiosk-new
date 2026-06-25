import './assets/scss/app.scss'

import { createApp } from 'vue'
import router from './router'
import { createPinia } from 'pinia'
import App from './App.vue'

// 프로덕션(키오스크 배포본)에서만 마우스 커서를 숨긴다. dev에서는 포인터가 보이게 유지
if (import.meta.env.PROD) {
  document.documentElement.classList.add('hide-cursor')
}

const app = createApp(App)
const pinia = createPinia()

app.use(router)
app.use(pinia)

app.mount('#app')
