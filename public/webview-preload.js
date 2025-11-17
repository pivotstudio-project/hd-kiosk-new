// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ipcRenderer } = require('electron')

document.addEventListener('DOMContentLoaded', () => {
  if (ipcRenderer) {
    ipcRenderer.send('hide-touch-keyboard')
    console.log('돔 준비 완료')

    document.addEventListener('scroll', () => {
      console.log('스크롤 감지!')
      ipcRenderer.send('user-activity', { type: 'scroll' })
    })

    document.addEventListener('pointerdown', (event) => {
      const target = event.target

      ipcRenderer.send('user-activity', { type: 'pointerdown', pointerType: event.pointerType })
      console.log('다운다운 감지')
      ipcRenderer.send('hide-touch-keyboard')

      // 키보드 표시 여부 결정
      const showKeyboard = target.tagName === 'INPUT' && target.type === 'text' && !target.closest('.el-input--suffix')

      if (showKeyboard) {
        console.log('키보드 감지!', target.tagName)
        ipcRenderer.send('user-activity', { type: 'focus', tag: target.tagName })
        ipcRenderer.send('show-touch-keyboard')
        console.log('실행')
      } else {
        ipcRenderer.send('hide-touch-keyboard')
      }
    })
  }
})
