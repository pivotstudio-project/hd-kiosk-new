import { app, BrowserWindow, ipcMain, WebContentsView, dialog } from 'electron'
import path, { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { exec } from 'child_process'
import log from 'electron-log'
import { autoUpdater } from 'electron-updater'

// 1. 현재 실행 파일의 이름(또는 productName)을 감지
const exeName = path.basename(process.execPath, '.exe') // 예: "HD Kiosk EV"

// 2. 개발 모드가 아닐 때(배포판일 때), 데이터 경로를 강제로 분리
if (!is.dev) {
  // 예: C:\Users\User\AppData\Roaming\HD Kiosk EV
  const newUserDataPath = join(app.getPath('appData'), exeName)
  app.setPath('userData', newUserDataPath)
}

const storePath = join(app.getPath('userData'), 'kiosk.json')

export function saveKioskInfo(info: { name: string; mode: string }): void {
  writeFileSync(storePath, JSON.stringify(info))
}

export function loadKioskInfo(): { name: string; mode: string } {
  if (!existsSync(storePath)) return { name: '', mode: '' }
  return JSON.parse(readFileSync(storePath, 'utf-8'))
}

export function resetKioskInfo(): void {
  if (existsSync(storePath)) writeFileSync(storePath, JSON.stringify({ name: '', mode: '' }))
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // 중복 실행이면 앱 종료
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // --- 전역 변수 ---
  let mainWindow: BrowserWindow | null = null
  const webViews: Map<string, WebContentsView> = new Map()
  // WebView 상태 관리 추가
  const webViewStates: Map<string, 'creating' | 'active' | 'destroying'> = new Map()
  let isDownloadingUpdate = false


  const IDLE_TIMEOUT_DID = 3 * 60 * 1000 // 3분
  const IDLE_TIMEOUT_EV = 5 * 60 * 1000 // 5분

  function getDefaultIdleTimeout(): number {
    if (exeName.includes('DID')) return IDLE_TIMEOUT_DID
    if (exeName.includes('EV')) return IDLE_TIMEOUT_EV
    return 60 * 1000 // fallback
  }

  // 유휴 상태 관리
  let currentTimeout: number = getDefaultIdleTimeout()
  let idleTimer: NodeJS.Timeout | null = null

  function goHome(): void {
    if (isDownloadingUpdate) {
      console.log('[Idle] 업데이트 다운로드 중이므로 홈 이동을 건너뜁니다.')
      return
    }
    console.log('홈으로 돌아갑니다. 모든 WebView를 정리합니다.')

    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('go-to-home')
    }

    // 현재 활성화된 모든 WebView를 순회하며 안전하게 파괴
    const destroyPromises = Array.from(webViews.keys()).map((id) => destroyWebViewSafely(id))
    Promise.all(destroyPromises)
      .then(() => console.log('[Idle] 모든 WebView가 성공적으로 정리되었습니다.'))
      .catch((err) => console.error('[Idle] WebView 정리 중 오류 발생:', err))
  }

  function resetIdelTimer(timeout?: number): void {
    if (idleTimer) clearTimeout(idleTimer)

    if (typeof timeout === 'number') {
      currentTimeout = timeout
    }

    idleTimer = setTimeout(goHome, currentTimeout)

    console.log('[Idle] timeout:', currentTimeout)
  }

  // 자동 업데이트 함수
  function setupAutoUpdater(): void {
    // 1. 로그 설정 (배포 후 디버깅을 위해 필수)
  log.transports.file.level = 'info'
  autoUpdater.logger = log

  // 2. 자동 다운로드 설정
  // true: 업데이트 감지 시 즉시 백그라운드 다운로드 (키오스크에 권장)
  // false: 감지 후 사용자 동의를 받아야 다운로드
  autoUpdater.autoDownload = false

  // 전체 업데이트 반영
  autoUpdater.disableDifferentialDownload = true
  
  if (exeName.includes('EV')) {
    log.info(`[Updater] EV 모드 감지 (${exeName}): latest-ev.yml 참조`)
    autoUpdater.channel = 'latest-ev'
    
    // (선택 사항) 강제로 requestHeaders 등을 설정해야 할 수도 있으나 
    // channel 설정만으로도 파일명 접두사가 바뀝니다.
  } else if (exeName.includes('DID')) {
    log.info(`[Updater] DID 모드 감지 (${exeName}): latest-did.yml 참조`)
    autoUpdater.channel = 'latest-did'
  } else {
    // [디버깅용] 어떤 모드도 아닐 경우 로그 남기기
    log.warn(`[Updater] 모드 감지 실패 (${exeName}). 기본 latest.yml을 참조합니다.`)
  }

  // 3. 업데이트 확인 시작
  // *중요*: checkForUpdatesAndNotify() 대신 checkForUpdates() 사용
  // 이유: 키오스크 화면 위에 Windows 시스템 알림(Toast)이 뜨는 것을 방지하기 위함
  autoUpdater.checkForUpdates()

  // --- 이벤트 리스너 ---

  // 업데이트 확인 시작
  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] 업데이트 확인 중...')
  })

  // 업데이트가 있음 (자동 다운로드 시작됨)
  autoUpdater.on('update-available', (info) => {
    log.info('[Updater] 새 업데이트 발견:', info.version)
    mainWindow?.webContents.send('update-available', { version: info.version })
  })

  // 업데이트 없음
  autoUpdater.on('update-not-available', () => {
    log.info('[Updater] 현재 최신 버전입니다.')
    mainWindow?.webContents.send('update-status', { status: 'not-available' })
  })

  // 다운로드 진행률 (옵션: 화면에 진행바를 보여주고 싶을 때 사용)
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.floor(progressObj.percent)
    mainWindow?.webContents.send('update-progress', percent)
  })

  // 다운로드 완료
  autoUpdater.on('update-downloaded', (info) => {
    log.info('[Updater] 다운로드 완료')
    isDownloadingUpdate = false
    mainWindow?.webContents.send('update-downloaded', { version: info.version })
  })

  // 에러 발생
  autoUpdater.on('error', (err) => {
    const message = err?.message ?? ''

    // 🔕 업데이트 대상 아님 → 무시할 에러들
    const ignorableErrors = [
      '404',
      'Cannot find latest',
      'No published versions',
      'ERR_UPDATER_INVALID_RELEASE_FEED',
      'HttpError: 404'
    ]

    const isIgnorable = ignorableErrors.some((msg) =>
      message.includes(msg)
    )

    if (isIgnorable) {
      log.info('[Updater] 업데이트 대상 아님 (에러 무시):', message)
      return
    }

    // ❗ 진짜 문제만 사용자에게 표시
    log.error('[Updater] 업데이트 오류:', err)
    isDownloadingUpdate = false
    mainWindow?.webContents.send('update-error', message)
  })
}

  // [IPC 통신] 렌더러에서 "다운로드 시작해!"라고 요청하면 실행
ipcMain.on('start-download', () => {
  log.info('[Updater] 사용자 요청으로 다운로드 시작')
  // [추가] 다운로드 모드 진입
  isDownloadingUpdate = true
  
  // [추가] 현재 돌고 있는 유휴 타이머 즉시 해제 (중요)
  if (idleTimer) clearTimeout(idleTimer)

  autoUpdater.downloadUpdate()
})

// [IPC 통신] 렌더러에서 "재시작해!"라고 요청하면 실행
ipcMain.on('install-update', () => {
  log.info('[Updater] 설치 및 재시작')
  autoUpdater.quitAndInstall(true, true)
})

  // --- 인터페이스 및 페이지 설정 데이터 ---
  interface PageConfig {
    id: string
    label: string
    pageName: string
    url: string
    removeSelectors?: string[]
    group?: 'A' | 'B' | 'C'
  }

  const pages: PageConfig[] = [
    {
      id: 'explorer',
      label: '내 차 추천받기',
      pageName: '내 차 추천받기',
      url: 'https://www.hyundai.com/kr/ko/e/vehicles/explorer',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.banner-wrap',
        '.carousel-wrap',
        '.btn-wide-3',
        '.btn-gray',
        '.link-article',
        '.top-breadcrumb',
        '.breadcrumb',
        '.title-box .btn',
        '.select-total .btn-article'
      ],
      group: 'A'
    },
    {
      id: 'comparison',
      label: '모델 비교',
      pageName: '모델 비교',
      url: 'https://www.hyundai.com/kr/ko/e/vehicles/comparison',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.msg-lists',
        '.hyundai-selected',
        '.top-breadcrumb',
        '.breadcrumb'
      ],
      group: 'A'
    },
    {
      id: 'trend',
      label: 'Trendy Hyundai',
      pageName: '모델 트렌드',
      url: 'https://www.hyundai.com/kr/ko/e/vehicles/trendy-hyundai?utm_source=hyundaicom&utm_medium=gnb&utm_campaign=trendy_hyundai',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.kv-utils',
        '.btn-wrap',
        '.banner',
        '.btn-wrap',
        '.img-lists',
        '.spec-link',
        '.trendy-media-tab',
        '.trendy-news',
        '.trendy-review-wrap',
        '.trend-membership',
        '.trend-hot-menu',
        '.report-share',
        '.accessbility',
        '.trendy-inside-hyundai',
        '.top-breadcrumb',
        '.breadcrumb'
      ],
      group: 'A'
    },
    {
      id: 'catalog',
      label: '카탈로그/가격표',
      pageName: '디지털 카탈로그(승용 차종)',
      url: 'https://www.hyundai.com/kr/ko/e/vehicles/catalog-price-download',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.list-dot',
        '.top-breadcrumb',
        '.breadcrumb'
      ],
      group: 'A'
    },
    {
      id: 'catalog02',
      label: '카탈로그/가격표',
      pageName: '디지털 카탈로그 (상용 차종)',
      url: 'https://www.hyundai.com/kr/ko/c/purchase-guid/catalog',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.list_dot',
        '.top-breadcrumb',
        '.breadcrumb'
      ]
    },
    {
      id: 'estimation',
      label: '내 차 만들기',
      pageName: '내 차 만들기',
      url: 'https://www.hyundai.com/kr/ko/e/vehicles/estimation',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.close-btn',
        '.content-select-area',
        '.content__notice',
        '.top-breadcrumb',
        '.breadcrumb',
        '.btn-casper-close',
        '.floating-wrap .btn-1',
        '.floating-wrap .btn-2',
        '.floating-wrap .btn-3',
        '.total-wrap .cont-bottom'
      ],
      group: 'A'
    },
    {
      id: 'review',
      label: '구매 후기',
      pageName: '구매 후기',
      url: 'https://www.hyundai.com/kr/ko/purchase-event/vehicles-review',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.ck-my-review',
        '.top-breadcrumb',
        '.breadcrumb'
      ],
      group: 'A'
    },
    {
      id: 'cost',
      label: 'EV 구매 유지비',
      pageName: 'EV 구매 유지비',
      url: 'https://www.hyundai.com/kr/ko/e/service-membership/ev/hi-ev?EVcost=true',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.quick-menu',
        '.banner-wrap',
        '.sticky-wrap',
        '.top-breadcrumb',
        '.breadcrumb'
      ],
      group: 'A'
    },
    {
      id: 'everycare',
      label: 'EV 에브리케어',
      pageName: 'EV 에브리케어 (구매 시)',
      url: 'https://www.hyundai.com/kr/ko/service-membership/ev/ev-everycare/add',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.button_wrap02',
        '.btn_md_primary',
        '.action',
        '.top-breadcrumb',
        '.breadcrumb'
      ],
      group: 'A'
    },
    {
      id: 'everycare02',
      label: 'EV 에브리케어',
      pageName: 'EV 에브리케어 (운행 시)',
      url: 'https://www.hyundai.com/kr/ko/service-membership/ev/ev-everycare/driving',
      removeSelectors: [
        '.action',
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.section_white',
        '.btn_md_primary',
        '.top-breadcrumb',
        '.breadcrumb'
      ]
    },
    {
      id: 'everycare03',
      label: 'EV 에브리케어',
      pageName: 'EV 에브리케어 (매각 시)',
      url: 'https://www.hyundai.com/kr/ko/service-membership/ev/ev-everycare/sell-off',
      removeSelectors: [
        '.action',
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.btn_md_primary',
        '.top-breadcrumb',
        '.breadcrumb'
      ]
    },
    {
      id: 'battery',
      label: '배터리 정보',
      pageName: '배터리 정보',
      url: 'https://www.hyundai.com/kr/ko/service-membership/ev/ev-battery-cell-information',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.page_btns',
        '.top-breadcrumb',
        '.breadcrumb'
      ],
      group: 'A'
    },
    {
      id: 'charging',
      label: '충전소 찾기',
      pageName: '충전소 찾기 (전기)',
      url: 'https://www.hyundai.com/kr/ko/service-membership/ev/ev-charging-station',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.list_bullet_dot',
        '.top-breadcrumb',
        '.breadcrumb'
      ],
      group: 'A'
    },
    {
      id: 'charging02',
      label: '충전소 찾기',
      pageName: '충전소 찾기 (수소전기)',
      url: 'https://www.hyundai.com/kr/ko/service-membership/ev/ev-charging-station?tab=2',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.list_bullet_dot',
        '.top-breadcrumb',
        '.breadcrumb'
      ]
    },
    {
      id: 'benefit',
      label: '이 달의 구매 혜택',
      pageName: '이달의 구매혜택 (승용 차종)',
      url: 'https://www.hyundai.com/kr/ko/e/vehicles/monthly-benefit',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.btn-group',
        '.top-breadcrumb',
        '.breadcrumb'
      ],
      group: 'B'
    },
    {
      id: 'benefit02',
      label: '이 달의 구매 혜택',
      pageName: '이달의 구매혜택 (상용 차종)',
      url: 'https://www.hyundai.com/kr/ko/c/purchase-guid/special-offers',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.btn-group',
        '.top-breadcrumb',
        '.breadcrumb'
      ]
    },
    {
      id: 'save',
      label: 'H-Super Save',
      pageName: 'H-Super Save',
      url: 'https://www.hyundai.com/kr/ko/e/vehicles/special-conditions-benefit',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.btn-group',
        '.top-breadcrumb',
        '.breadcrumb'
      ],
      group: 'B'
    },
    {
      id: 'v2l',
      label: '이벤트',
      pageName: 'V2L',
      url: 'https://www.hyundai.com/kr/ko/event/event-2025-welcome-h-family-care-program',
      removeSelectors: [
        '.header',
        '.wrap-header',
        '.foot-area',
        '.area-floating',
        '.sns_share',
        '.board_btns',
        '.top-breadcrumb',
        '.breadcrumb'
      ],
      group: 'C'
    }
  ]

  // 개선된 WebContentsView 생성 함수
  function createWebView(pageConfig: PageConfig): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, '../../public/webview-preload.js'),
        contextIsolation: true,
        partition: 'persist:hd-kiosk'
      }
    })

    setupWebViewEvents(view, pageConfig)
    return view
  }

  // 이벤트 리스너 설정 (중복 방지 및 안전한 처리)
  function setupWebViewEvents(view: WebContentsView, pageConfig: PageConfig): void {
    let isLoading = false
    let eventListenersSetup = false

    // 중복 설정 방지
    if (eventListenersSetup) return
    eventListenersSetup = true

    const applyHide = (): void => {
      if (!pageConfig.removeSelectors?.length) return

      const css = pageConfig.removeSelectors
        .map((sel) => `${sel} { display: none !important; }`)
        .join('\n')

      view.webContents.insertCSS(css).catch((err) => console.warn('insertCSS failed:', err))
    }

    // 페이지 이동이 완료될 때마다 렌더러에 URL을 전송
    const handleNavigate = (_, url: string): void => {
      if (mainWindow) {
        mainWindow.webContents.send('webview-url-changed', { id: pageConfig.id, url: url })
      }
    }

    // 일반적인 탐색과 페이지 내 탐색을 모두 감지
    view.webContents.on('did-navigate', handleNavigate)
    view.webContents.on('did-navigate-in-page', handleNavigate)

    view.webContents.on('did-finish-load', () => {
      // 페이지 로드 완료 후 CSS 적용
      setTimeout(() => {
        applyHide()
      }, 100) // 100ms 지연으로 DOM 완전 렌더링 후 적용

      mainWindow?.webContents.send('loading-status', false)
      isLoading = false
    })

    view.webContents.on('did-fail-load', (_, code, desc) => {
      console.error(`Failed to load ${pageConfig.id}: ${desc} (${code})`)
      mainWindow?.webContents.send('loading-status', false)
      isLoading = false

      const ignoredErrorCodes = [-3, -2]
      if (mainWindow && !view.webContents.isDestroyed() && !ignoredErrorCodes.includes(code)) {
        mainWindow.webContents.send('webview-load-failed', {
          id: pageConfig.id,
          errorCode: code,
          errorDescription: desc
        })
      }
    })

    view.webContents.on('did-start-loading', () => {
      if (!isLoading) {
        mainWindow?.webContents.send('loading-status', true)
        isLoading = true
      }
    })

    // 페이지 내 네비게이션에서도 CSS 적용
    view.webContents.on('did-navigate-in-page', () => {
      setTimeout(() => {
        applyHide()
      }, 100)
    })

    // 팝업 처리 개선
    view.webContents.setWindowOpenHandler(({ url }) => {
      // 안전한 URL 로드
      setTimeout(() => {
        if (!view.webContents.isDestroyed()) {
          view.webContents.loadURL(url).catch(console.error)
        }
      }, 0)
      return { action: 'deny' }
    })
  }

  // 안전한 WebView 삭제 함수
  async function destroyWebViewSafely(id: string): Promise<void> {
    const view = webViews.get(id)
    if (!view) return

    console.log(`[WebView] Destroying ${id}`)
    webViewStates.set(id, 'destroying')

    try {
      // 먼저 화면에서 숨기기
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 })

      // 로딩 중인 경우 중단
      if (view.webContents.isLoading()) {
        view.webContents.stop()
      }

      // 이벤트 리스너 정리
      view.webContents.removeAllListeners()

      // WebContents 정리 (비동기)
      return new Promise<void>((resolve) => {
        const cleanup = () => {
          webViews.delete(id)
          webViewStates.delete(id)
          console.log(`[WebView] ${id} destroyed successfully`)
          resolve()
        }

        if (view.webContents.isDestroyed()) {
          cleanup()
        } else {
          view.webContents.once('destroyed', cleanup)
          // 강제로 destroy 호출
          try {
            ;(view.webContents as any).destroy()
          } catch (error) {
            console.warn(`Error destroying webContents for ${id}:`, error)
            cleanup() // 에러가 발생해도 정리는 완료
          }
        }
      })
    } catch (error) {
      console.error(`Error destroying webview ${id}:`, error)
      // 에러가 발생해도 Map에서는 제거
      webViews.delete(id)
      webViewStates.delete(id)
    }
  }

  // 다른 뷰들을 숨기는 함수
  async function hideOtherViews(activeId: string): Promise<void> {
    const promises: Promise<void>[] = []

    webViews.forEach((view, viewId) => {
      if (viewId !== activeId) {
        // bounds만 0으로 설정하여 숨기기 (destroy하지 않음)
        view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
      }
    })

    return Promise.all(promises).then(() => {})
  }

  // 순차적 URL 로드 및 설정
  async function loadAndSetupView(
    view: WebContentsView,
    pageConfig: PageConfig,
    bounds: { width: number; height: number }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(`Timeout loading ${pageConfig.url}`)
        reject(new Error(`Timeout loading ${pageConfig.url}`))
      }, 15000) // 15초 타임아웃

      const onLoad = () => {
        clearTimeout(timeout)

        // 로드 완료 후 bounds 설정
        setTimeout(() => {
          if (!view.webContents.isDestroyed()) {
            const kioskInfo = loadKioskInfo()
            const yOffset = kioskInfo.mode === 'did' ? 100 : 0

            view.setBounds({
              x: 0,
              y: yOffset,
              width: bounds.width,
              height: bounds.height - 100
            })
          }
          resolve()
        }, 100) // DOM 렌더링 완료를 위한 지연
      }

      const onError = (_, code: number, desc: string) => {
        clearTimeout(timeout)
        console.error(`Failed to load ${pageConfig.url}: ${desc} (${code})`)
        reject(new Error(`Failed to load: ${desc}`))
      }

      // 이벤트 리스너 등록
      view.webContents.once('did-finish-load', onLoad)
      view.webContents.once('did-fail-load', onError)

      // navigation history 먼저 clear
      view.webContents.navigationHistory.clear()

      // URL 로드 시작
      view.webContents.loadURL(pageConfig.url).catch((error) => {
        console.error(`Failed to initiate URL load for ${pageConfig.url}:`, error)
        clearTimeout(timeout)
        reject(error) // Promise 체인에 에러를 그대로 전달
      })
    })
  }

  /**
   * 메인 윈도우 생성 및 초기화 함수
   */
  async function createWindow(): Promise<void> {
    mainWindow = new BrowserWindow({
      fullscreen: true,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: false,
        nodeIntegration: true
      }
    })

    // 렌더러(Vue 앱) 로드
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    // 렌더러까지 준비되면 창을 보여줌
    mainWindow.on('ready-to-show', () => {
      mainWindow?.show()
    })
  }

  // --- 개선된 IPC (프로세스 간 통신) ---

  ipcMain.handle('get-page-config', () => {
    return pages
  })

  // 메모리 비우기 함수 추가
  function hideAndResetWebView(id: string): void {
    const view = webViews.get(id)
    if (!view || view.webContents.isDestroyed()) return

    console.log(`[WebView] Hiding and resetting ${id}`)
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 })

    if (view.webContents.isLoading()) {
      view.webContents.stop()
    }

    // 'about:blank'로 이동시켜 현재 페이지의 메모리를 해제 (핵심 최적화)
    view.webContents.loadURL('about:blank').catch(console.error)
  }

  // 개선된 webview 관리
  ipcMain.on('manage-webview', async (_, { action, id }: { action: string; id: string }) => {
    if (!mainWindow || !id) return

    const pageConfig = pages.find((p) => p.id === id)
    if (!pageConfig) return

    if (action === 'show') {
      const currentState = webViewStates.get(id)
      if (currentState === 'creating') {
        console.log(`WebView ${id} is already creating, skipping...`)
        return
      }

      webViewStates.set(id, 'creating')
      console.log(`[WebView] Showing or creating ${id}`)

      try {
        // 1. 뷰가 존재하는지 확인, 없으면 새로 생성
        let view = webViews.get(id)
        if (!view) {
          console.log(`[WebView] No existing view for ${id}, creating new one.`)
          view = createWebView(pageConfig)
          mainWindow.contentView.addChildView(view)
          webViews.set(id, view)
        }

        // 2. 다른 뷰들은 모두 숨김
        await hideOtherViews(id)

        // 3. 뷰에 URL 로드 및 화면에 표시 (재사용 시 URL 재로드)
        await loadAndSetupView(view, pageConfig, mainWindow.getBounds())

        webViewStates.set(id, 'active')
        console.log(`[WebView] ${id} activated successfully`)
      } catch (error) {
        console.error(`Failed to create/show webview ${id}:`, error)
        await destroyWebViewSafely(id) // 실패 시에는 확실히 파괴
      }
    } else if (action === 'hide') {
      // 파괴 대신 숨기기 및 초기화 함수 호출
      hideAndResetWebView(id)
    }
  })

  ipcMain.handle('webview-can-go-back', (_, id: string) => {
    const view = webViews.get(id)
    if (!view || view.webContents.isDestroyed()) return false

    const canGoBack = view.webContents.navigationHistory.canGoBack()
    if (!canGoBack) return false

    // 뒤로갈 수 있는 URL이 유효한지 미리 체크
    const history = view.webContents.navigationHistory
    const currentIndex = history.getActiveIndex()

    if (currentIndex > 0) {
      const previousEntry = history.getEntryAtIndex(currentIndex - 1)
      const previousUrl = previousEntry?.url

      // about:blank이나 빈 URL이면 뒤로가기 불가
      if (!previousUrl || previousUrl === 'about:blank' || previousUrl === '') {
        return false
      }
    }

    return true
  })

  ipcMain.on('webview-control', (_, { action, id }: { action: string; id: string }) => {
    const view = webViews.get(id)
    if (!view || view.webContents.isDestroyed()) return

    const nav = view.webContents.navigationHistory
    if (action === 'back' && nav.canGoBack()) nav.goBack()
    else if (action === 'forward' && nav.canGoForward()) nav.goForward()
  })

  ipcMain.on('manipulate-webview-dom', (_, { id, selector }: { id: string; selector: string }) => {
    const view = webViews.get(id)
    if (!view || view.webContents.isDestroyed()) return

    view.webContents
      .executeJavaScript(`document.querySelectorAll('${selector}').forEach(el => el.remove())`)
      .catch(console.warn)
  })

  ipcMain.handle('get-current-url', async (_, id) => {
    const maxRetries = 10
    const retryDelay = 100

    for (let i = 0; i < maxRetries; i++) {
      const view = webViews.get(id)

      if (view && !view.webContents.isDestroyed()) {
        try {
          return view.webContents.getURL()
        } catch (error) {
          console.warn(`Error getting URL for ${id}, retry ${i + 1}:`, error)
        }
      }

      // 뷰가 없거나 에러가 발생하면 잠시 대기
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }

    console.error(`Error: Failed to get URL for WebView "${id}" after multiple retries.`)
    return null
  })

  ipcMain.on('webview-load-url', (_, { id, url }: { id: string; url: string }) => {
    console.log(`[Main Process] '${id}' 뷰에 URL 강제 로드 요청: ${url}`)
    const view = webViews.get(id)
    if (!view || view.webContents.isDestroyed()) return

    view.webContents.navigationHistory.clear()
    view.webContents.loadURL(url).catch(console.error)
  })

  ipcMain.handle('get-kiosk-info', () => loadKioskInfo())
  ipcMain.handle('set-kiosk-info', (_, info) => saveKioskInfo(info))
  ipcMain.handle('reset-kiosk-info', () => resetKioskInfo())

  ipcMain.on('user-activity', (_, data) => {
    console.log('[Main Process] 사용자 활동 감지:', data)
    resetIdelTimer()
  })

  ipcMain.on('set-idle-timeout', (_, timeoutMs: number) => {
    console.log('[Main Process] IDLE_TIMEOUT 변경 요청:', timeoutMs)
    resetIdelTimer(timeoutMs)
  })

  // 키보드 불러오기
  ipcMain.on('show-touch-keyboard', () => {
    const oskPath = 'C:\\Windows\\System32\\osk.exe'

    exec(`"${oskPath}"`, (err) => {
      if (err) {
        console.error('화면 키보드 실행 실패:', err)
      } else {
        console.log('화면 키보드 실행됨 (osk.exe)')
      }
    })
  })

  ipcMain.on('hide-touch-keyboard', () => {
    exec('taskkill /IM osk.exe /F', (err) => {
      if (err) {
        console.error('화면 키보드 종료 실패:', err)
      } else {
        console.log('화면 키보드 종료됨 (osk.exe)')
      }
    })
  })

  ipcMain.handle('confirm-before-quit', async () => {
    try {
      if (mainWindow) {
        const result = dialog.showMessageBoxSync(mainWindow, {
          type: 'question',
          buttons: ['취소', '확인'],
          title: '종료 확인',
          message: '정말 종료하시겠습니까?',
          defaultId: 1,
          cancelId: 0
        })
        return result === 1
      }
      return false
    } catch (error) {
      console.error('확인 대화상자 오류:', error)
      return false
    }
  })

  // Vue에서 강제 종료 요청 시 처리
  ipcMain.on('force-quit', async () => {
    console.log('강제 종료 요청 - 앱 종료')

    // 모든 WebContentsView 안전하게 정리
    const destroyPromises = Array.from(webViews.keys()).map((id) => destroyWebViewSafely(id))

    try {
      await Promise.all(destroyPromises)
      console.log('모든 WebView 정리 완료')
    } catch (error) {
      console.warn('WebView 정리 중 오류 발생:', error)
    } finally {
      // 정리 완료 후 앱 종료
      app.exit(0)
    }
  })

  // 디버그용 WebView 상태 모니터링 (개발 환경에서만)
  if (is.dev) {
    setInterval(() => {
      console.log('=== WebView Status ===')
      console.log(`Active views: ${webViews.size}`)
      console.log(`States:`, Array.from(webViewStates.entries()))

      // 정리되지 않은 WebView 감지 및 자동 정리
      webViews.forEach((view, id) => {
        if (view.webContents.isDestroyed()) {
          console.warn(`⚠️ Destroyed webview still in map: ${id}`)
          webViews.delete(id)
          webViewStates.delete(id)
        }
      })
    }, 10000) // 10초마다 체크
  }

  // --- 앱 생명주기 ---

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.hdkiosk')
    createWindow().then(() => {
      setupAutoUpdater()
      resetIdelTimer()
    })
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })



  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // 앱 종료 시 모든 WebView 정리
  app.on('before-quit', async (event) => {
    if (webViews.size > 0) {
      event.preventDefault()
      console.log('앱 종료 전 WebView 정리 중...')

      const destroyPromises = Array.from(webViews.keys()).map((id) => destroyWebViewSafely(id))

      try {
        await Promise.all(destroyPromises)
        console.log('모든 WebView 정리 완료')
      } catch (error) {
        console.warn('WebView 정리 중 오류:', error)
      }

      // 정리 완료 후 실제 종료
      app.quit()
    }
  })

  // --- 수동 업데이트 확인 ---
  ipcMain.on('check-for-updates-manual', () => {
    log.info('[Updater] 수동 업데이트 확인 요청')
    autoUpdater.checkForUpdates()
  })

  // --- IPC: 업데이트 설치 요청 ---
  ipcMain.on('quit-and-install', () => {
    console.log('[Updater] 사용자 요청으로 업데이트 적용 후 재시작')
    autoUpdater.quitAndInstall(true, true)
  })

  ipcMain.on('stop-idle-timer', () => {
    console.log('[Main] 유휴 타이머 정지 요청')
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null // 타이머 변수 초기화
    }
  })

  ipcMain.on('start-idle-timer', () => {
    console.log('[Main] 유휴 타이머 재시작 요청')
    resetIdelTimer() // 기존에 만들어둔 타이머 리셋 함수 호출
  })
}
