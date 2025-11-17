import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useKioskStore = defineStore('kiosk', () => {
  // --- 기존 코드 ---
  const currentMode = ref<string | null>(null)

  function setMode(mode: string): void {
    console.log(`[Pinia] Mode set to: ${mode}`)
    currentMode.value = mode
  }

  // --- 추가된 코드 ---
  const kioskName = ref<string>('')

  function setKioskName(name: string): void {
    console.log(`[Pinia] Kiosk name set to: ${name}`)
    kioskName.value = name
  }

  // -----------------

  return {
    currentMode,
    setMode,
    kioskName, // 외부에서 사용할 수 있도록 반환
    setKioskName // 외부에서 사용할 수 있도록 반환
  }
})
