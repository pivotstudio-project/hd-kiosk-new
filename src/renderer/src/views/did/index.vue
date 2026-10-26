<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { EffectFade, Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-fade'
import DidBenefitBlocks from '../../components/DidBenefitBlocks.vue'

import imgAvante from '../../assets/did-poster-avante.jpg'
import imgTucson from '../../assets/did-poster-tucson.jpg'

const modules = [EffectFade, Autoplay]

const { ipcRenderer } = window.electron

// 루핑 포스터: 아반떼 / 투싼 2장만. 탭하면 이달의 구매혜택(groupB[0]) 웹뷰로 이동.
const posters = [imgAvante, imgTucson]

// CTA(구매혜택) 슬라이드는 숨김. 다시 노출하려면 아래 항목 주석 해제.
const tailSlides = [
  // { type: 'custom', delay: 30000 }
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
  // 이달의 구매혜택 링크 (DidBenefitBlocks의 블록 1과 동일). 설정이 없으면 선택화면(hub)으로.
  const config = (await ipcRenderer.invoke('get-page-config')) || []
  const benefit = config.filter((page: any) => page.group === 'B')[0]
  const to = benefit
    ? { name: 'webview', query: { id: benefit.id, name: benefit.pageName, type: 'did' } }
    : '/did/hub'

  const shuffleSlides = posters.map((img) => ({ type: 'image', to, img, delay: 5000 }))

  // 이미지 슬라이드만 셔플하고, 꼬리 슬라이드는 고정으로 붙임
  slides.value = [...shuffle(shuffleSlides), ...tailSlides]
  isLoaded.value = true
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

      <!-- 링크 없는 이미지 슬라이드 (did-cover08 등): 클릭해도 이동 없음 + 높이에 맞춤 -->
      <div v-else-if="slide.type === 'image'" class="page-common page-common--contain">
        <img :src="slide.img" alt="이미지" />
      </div>

      <!-- 커스텀(마지막) 슬라이드: 구매혜택 2블록 (선택화면과 공용 컴포넌트) -->
      <DidBenefitBlocks v-else-if="slide.type === 'custom'" />
    </swiper-slide>
  </swiper>
</template>

<style scoped>
/* did-cover08처럼 세로로 긴 이미지는 너비가 아닌 높이에 맞춰 화면 안에 들어오게 */
.page-common.page-common--contain :deep(img) {
  width: auto;
  height: 100%;
  max-width: 100%;
  object-fit: contain;
}
</style>