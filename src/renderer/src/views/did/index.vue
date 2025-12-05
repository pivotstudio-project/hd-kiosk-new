<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { EffectFade, Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-fade'
import { useRouter } from 'vue-router'

const router = useRouter()
const { ipcRenderer } = window.electron

const allPages: any = ref([])
const groupB = computed(() => allPages.value.filter((page) => page.group === 'B'))

/**
 * 버튼 클릭 시 id를 받아 webview 페이지로 이동합니다.
 * @param pageId 이동할 페이지의 고유 ID
 */
const openLink = (pageId: string, pageName: string): void => {
  // pageId가 유효한지 간단히 확인합니다.
  if (pageId) {
    // 라우터를 통해 새로운 페이지로 이동하고, 쿼리 파라미터로 'id'를 전달합니다.
    router.push({ name: 'webview', query: { id: pageId, name: pageName } })
  } else {
    console.error('페이지 ID가 없어 이동할 수 없습니다.')
  }
}

import img1 from '../../assets/did-cover01.jpg'
import img2 from '../../assets/did-cover02.jpg'
import img3 from '../../assets/did-cover03.jpg'
import img4 from '../../assets/did-cover04.jpg'
import img5 from '../../assets/did-cover05.jpg'

const modules = [EffectFade, Autoplay]

// 원본 슬라이드 배열
const originalSlides = [
  { type: 'image', to: '/did/hub', img: img1, delay: 5000 },
  { type: 'image', to: '/did/hub', img: img2, delay: 5000 },
  { type: 'image', to: '/did/hub', img: img3, delay: 5000 },
  { type: 'image', to: '/did/hub', img: img4, delay: 5000 },
  { type: 'image', to: '/did/hub', img: img5, delay: 5000 },
  { type: 'custom', delay: 5000 }
]

const slides = ref<typeof originalSlides>([])

// Fisher–Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const result = array.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

onMounted(() => {
  slides.value = shuffle(originalSlides)
})

onMounted(async () => {
  allPages.value = await ipcRenderer.invoke('get-page-config')
})
</script>

<template>
  <swiper
    class="mySwiper did-swiper"
    effect="fade"
    :modules="modules"
    loop
    :autoplay="{ delay: 5000, disableOnInteraction: false }"
  >
    <swiper-slide v-for="(slide, idx) in slides" :key="idx" :data-swiper-autoplay="slide.delay">
      <router-link v-if="slide.type === 'image' && slide.to" :to="slide.to" class="page-common">
        <img :src="slide.img" alt="이미지" />
      </router-link>

      <section v-else-if="slide.type === 'custom'" class="page-did-hub">
        <template v-for="item in groupB" :key="item.id">
          <div class="page-did-hub__contents" :class="{ gray: item.id === 'save' }">
            <h1>{{ item.label }}</h1>
            <template v-if="item.id === 'benefit'">
              <p>현대자동차의 특별하고 스마트한<br />월별 구매혜택/차종별 구매혜택</p>
            </template>
            <template v-else>
              <p>이달만의 특별한 현대자동차의 구매혜택</p>
            </template>
            <button @click="openLink(item.id, item.pageName)">자세히 보기</button>
          </div>
        </template>
      </section>
    </swiper-slide>
  </swiper>
</template>
