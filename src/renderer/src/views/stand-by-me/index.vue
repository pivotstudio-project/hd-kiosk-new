<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

/**
 * 지정된 pageId를 Webview 페이지로 전달하여 엽니다.
 * @param pageId main 프로세스에 정의된 페이지의 고유 ID
 */
const openLink = (pageId: string): void => {
  if (pageId) {
    // Webview 페이지로 이동하며 쿼리에 id를 전달합니다.
    router.push({ name: 'webview', query: { id: pageId, name: pageId } })
  } else {
    console.error('페이지 ID가 없어 이동할 수 없습니다.')
  }
}
</script>

<template>
  <div class="page-common" @click="openLink('v2l')">
    <img src="/stb-cover.png" />
  </div>
</template>
