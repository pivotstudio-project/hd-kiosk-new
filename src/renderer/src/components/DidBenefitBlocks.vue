<script setup lang="ts">
import { ref, computed, onBeforeMount } from 'vue'
import { useRouter } from 'vue-router'

// DID 인트로 마지막 슬라이드와 선택화면(hub)에서 공통으로 쓰는 구매혜택 블록.
// 블록을 추가/삭제하려면 아래 `blocks` 배열의 항목만 넣고 빼면 되고,
// 개수에 따라 레이아웃(1개=중앙정렬 / 2개 이상=균등 분할)이 자동으로 맞춰진다.
const router = useRouter()
const { ipcRenderer } = window.electron

const allPages = ref<any[]>([])
const groupB = computed(() => allPages.value.filter((page: any) => page.group === 'B'))

onBeforeMount(async () => {
  const config = await ipcRenderer.invoke('get-page-config')
  allPages.value = config || []
})

interface Block {
  title: string
  desc: string
  id: string
  name: string
  gray?: boolean
}

const blocks = computed<Block[]>(() => {
  const list: Block[] = []

  // [블록 1] 이 달의 구매 혜택 (groupB[0] 기반) — 빼려면 이 블록만 제거
  const benefit = groupB.value[0]
  if (benefit) {
    list.push({
      title: benefit.label,
      desc: '현대자동차의 특별하고 스마트한<br />월별 구매혜택/차종별 구매혜택',
      id: benefit.id,
      name: benefit.pageName
    })
  }

  // [블록 2] 썸머 페스타 특별 기획전 (→ special-conditions-benefit) — 빼려면 이 블록만 제거
  list.push({
    title: '썸머 페스타 특별 기획전',
    desc: '현대자동차의 특별한<br />이달의 한정 특별 구매혜택',
    id: 'save',
    name: '썸머 페스타 특별 기획전',
    gray: true
  })

  return list
})

const openLink = (pageId: string, pageName: string): void => {
  if (pageId) {
    router.push({ name: 'webview', query: { id: pageId, name: pageName, type: 'did' } })
  }
}
</script>

<template>
  <section
    v-if="groupB.length > 0 && blocks.length > 0"
    class="page-did-hub"
    :class="{ 'page-did-hub--multi': blocks.length > 1 }"
    :style="blocks.length > 1 ? { gridTemplateRows: `repeat(${blocks.length}, 1fr)` } : {}"
  >
    <img class="logo" :src="'./logo01.png'" />

    <div
      v-for="(block, i) in blocks"
      :key="i"
      class="page-did-hub__contents"
      :class="{ gray: block.gray }"
    >
      <h1>{{ block.title }}</h1>
      <p v-html="block.desc"></p>
      <button @click="openLink(block.id, block.name)">자세히 보기</button>
    </div>
  </section>
</template>

<style scoped>
/* 블록이 2개 이상일 때만 각 블록이 자기 행(grid-template-rows)을 꽉 채우도록.
   1개일 때는 기본 스타일(.page-did-hub__contents: height 70vh, align-self center)로 중앙 정렬 유지 */
.page-did-hub--multi :deep(.page-did-hub__contents) {
  height: 100%;
  align-self: stretch;
}
</style>
