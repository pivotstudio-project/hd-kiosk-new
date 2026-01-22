<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { EffectFade, Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-fade'
import { useRouter } from 'vue-router'

const router = useRouter()
const { ipcRenderer } = window.electron

const allPages = ref<any[]>([])
const groupB = computed(() => allPages.value.filter((page) => page.group === 'B'))

const openLink = (pageId: string, pageName: string): void => {
  if (pageId) {
    router.push({ name: 'webview', query: { id: pageId, name: pageName, type: 'did' } })
  }
}

import img1 from '../../assets/did-cover01.jpg'
import img2 from '../../assets/did-cover02.jpg'
import img3 from '../../assets/did-cover03.jpg'
import img4 from '../../assets/did-cover04.jpg'
import img5 from '../../assets/did-cover05.jpg'

const modules = [EffectFade, Autoplay]

const originalSlides = [
  { type: 'image', to: '/did/hub', img: img1, delay: 5000 },
  { type: 'image', to: '/did/hub', img: img2, delay: 5000 },
  { type: 'image', to: '/did/hub', img: img3, delay: 5000 },
  { type: 'image', to: '/did/hub', img: img4, delay: 5000 },
  { type: 'image', to: '/did/hub', img: img5, delay: 5000 },
  { type: 'custom', delay: 30000 }
]

const slides = ref<any[]>([])
const isLoaded = ref(false) // 데이터 로딩 상태 확인

function shuffle<T>(array: T[]): T[] {
  const result = array.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

onMounted(async () => {
  // 1. 데이터 먼저 가져오기
  try {
    const config = await ipcRenderer.invoke('get-page-config')
    allPages.value = config || []
    
    // 2. 슬라이드 셔플 후 할당
    slides.value = shuffle(originalSlides)
    
    // 3. 데이터가 준비되었음을 알림
    isLoaded.value = true
  } catch (error) {
    console.error("Config 로드 실패:", error)
  }
})
</script>

<template>
  <swiper
    v-if="isLoaded && slides.length > 0"
    class="mySwiper did-swiper"
    :effect="'fade'"
    :modules="modules"
    :autoplay="{ 
      delay: 5000,
      disableOnInteraction: false 
    }"
    :loop="true"
  >
    <swiper-slide 
      v-for="(slide, idx) in slides" 
      :key="idx" 
      :data-swiper-autoplay="slide.delay"
    >
      <router-link v-if="slide.type === 'image' && slide.to" :to="slide.to" class="page-common">
        <img :src="slide.img" alt="이미지" />
      </router-link>

      <section v-else-if="slide.type === 'custom' && groupB.length > 0" class="page-did-hub">
        <img class="logo" src="/logo01.png" />
        <div class="page-did-hub__contents">
            <h1>{{ groupB[0]?.label }}</h1>
            <p>현대자동차의 특별하고 스마트한<br />월별 구매혜택/차종별 구매혜택</p>
            <button @click="openLink(groupB[0]?.id, groupB[0]?.pageName)">자세히 보기</button>
          </div>
      </section>
    </swiper-slide>
  </swiper>
</template>