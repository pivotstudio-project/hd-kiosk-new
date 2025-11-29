<script setup lang="ts">
import { ref, onMounted } from 'vue'

// 상태 관리
const showModal = ref(false)
const updateStep = ref<'prompt' | 'downloading' | 'completed'>('prompt')
const version = ref('')
const progress = ref(0)

// Electron IPC 리스너 등록
onMounted(() => {
  // 1. 업데이트 감지됨
  window.electron.ipcRenderer.on('update-available', (_, info: any) => {
    version.value = info.version
    updateStep.value = 'prompt'
    showModal.value = true
  })

  // 2. 다운로드 진행 중
  window.electron.ipcRenderer.on('update-progress', (_, percent: number) => {
    progress.value = percent
  })

  // 3. 다운로드 완료
  window.electron.ipcRenderer.on('update-downloaded', () => {
    updateStep.value = 'completed'
  })
  
  // 에러 처리 (로그만 찍고 모달 닫기)
  window.electron.ipcRenderer.on('update-error', (_, err) => {
    console.error(err)
    alert('업데이트 중 오류가 발생했습니다.')
    showModal.value = false
  })
})

// 버튼 동작 함수들
const startDownload = () => {
  updateStep.value = 'downloading'
  window.electron.ipcRenderer.send('start-download')
}

const cancelUpdate = () => {
  showModal.value = false
}

const installNow = () => {
  window.electron.ipcRenderer.send('install-update')
}
</script>

<template>
  <div v-if="showModal" class="update-overlay">
    <div class="update-box">
      
      <div v-if="updateStep === 'prompt'">
        <h2>새로운 버전이 있습니다! (v{{ version }})</h2>
        <p>최신 기능을 위해 업데이트가 필요합니다.</p>
        <div class="btn-group">
          <button @click="cancelUpdate" class="btn-cancel">나중에</button>
          <button @click="startDownload" class="btn-ok">업데이트 시작</button>
        </div>
      </div>

      <div v-else-if="updateStep === 'downloading'">
        <h2>다운로드 중...</h2>
        <div class="progress-container">
          <div class="progress-bar" :style="{ width: progress + '%' }"></div>
        </div>
        <p class="percent-text">{{ progress }}%</p>
        <p class="sub-text">
          전원을 끄지 마세요.<br/>
          <br />
          다운로드 후 재설치까지 시간이 조금 걸립니다.<br/>
          재실행 될 때까지 그대로 두세요.
        </p>
      </div>

      <div v-else-if="updateStep === 'completed'">
        <h2>다운로드 완료</h2>
        <p>업데이트를 적용하기 위해 재시작합니다.</p>
        <div class="btn-group">
          <button @click="installNow" class="btn-ok">지금 재시작</button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.update-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.85); /* 배경 어둡게 */
  z-index: 99999; /* 모든 웹뷰 위에 뜸 */
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  font-family: 'Hyundai Sans Head', sans-serif; /* 폰트 있다면 적용 */
}

.update-box {
  background: #1c1c1c;
  padding: 40px;
  border-radius: 16px;
  text-align: center;
  width: 500px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  border: 1px solid #333;
}

h2 { margin-bottom: 10px; font-size: 24px; }
p { color: #aaa; margin-bottom: 30px; }

/* 버튼 스타일 */
.btn-group { display: flex; gap: 15px; justify-content: center; }
button {
  padding: 15px 30px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  font-weight: bold;
}
.btn-ok { background: #002c5f; color: white; } /* 현대 블루 느낌 */
.btn-cancel { background: #444; color: white; }

/* 프로그레스 바 스타일 */
.progress-container {
  width: 100%;
  height: 20px;
  background: #333;
  border-radius: 10px;
  overflow: hidden;
  margin: 20px 0;
}
.progress-bar {
  height: 100%;
  background: #007fa8; /* 액티브 컬러 */
  transition: width 0.3s ease;
}
.percent-text { font-size: 20px; font-weight: bold; color: white; margin: 0; }
.sub-text { font-size: 14px; margin-top: 10px; }
</style>