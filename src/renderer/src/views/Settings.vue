<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKioskStore } from '../stores/kiosk'

const { ipcRenderer } = window.electron || window.require?.('electron') || {}

const router = useRouter()
const kioskStore = useKioskStore()
const inputName = ref('') // 입력 필드와 연결될 변수

// 앱 시작 시 저장된 값 불러오기
onMounted(async () => {
  try {
    const data = await ipcRenderer.invoke('get-kiosk-info')
    inputName.value = data.name || ''
    kioskStore.setKioskName(data.name || '')
    kioskStore.setMode(data.mode || '')
  } catch (error) {
    console.error('Failed to load kiosk info:', error)
  }
})

async function selectMode(mode: string): Promise<void> {
  if (inputName.value.trim() === '') {
    alert('키오스크 이름을 입력하세요')
    return
  }

  window.api?.hideTouchKeyboard()

  try {
    const nameToSet = inputName.value.trim()

    // Pinia 상태 업데이트
    kioskStore.setKioskName(nameToSet)
    kioskStore.setMode(mode)

    // Electron main process에 저장
    await ipcRenderer.invoke('set-kiosk-info', {
      name: nameToSet,
      mode
    })

    router.replace(`/${mode}`)
  } catch (error) {
    console.error('Failed to set kiosk mode:', error)
  }
}

// 초기화 기능
async function resetKiosk(): Promise<void> {
  try {
    await ipcRenderer.invoke('reset-kiosk-info')
    inputName.value = ''
    kioskStore.setKioskName('')
    kioskStore.setMode('')
    alert('키오스크 정보가 초기화되었습니다.')
  } catch (error) {
    console.error('Failed to reset kiosk info:', error)
  }
}

onMounted(() => {
  window.api?.hideTouchKeyboard()

  const inputEl = document.getElementById('kiosk-name') as HTMLInputElement
  if (inputEl) {
    inputEl.addEventListener('pointerdown', () => {
      console.log('입력 필드 포커스 감지')
      window.api.showTouchKeyboard()
    })
  }
})
</script>

<template>
  <div class="page-settings">
    <div class="page-settings__wrapper">
      <h1 class="page-settings__title">키오스크 설정</h1>

      <div class="page-settings__group">
        <label for="kiosk-name">키오스크 이름을 입력하세요</label>
        <input id="kiosk-name" v-model="inputName" type="text" placeholder="예: 서울 전시장" />
      </div>

      <p class="page-settings__text">이 기기에서 실행할 프로그램을 선택해 주세요</p>
      <div class="page-settings__btn-group">
        <button @click="selectMode('ev-screen')">EV Screen</button>
        <button @click="selectMode('did')">DID</button>
      </div>

      <div class="page-settings__reset">
        <button @click="resetKiosk">키오스크 정보 초기화</button>
      </div>
    </div>
  </div>
</template>
