<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { EffectFade, Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-fade'
import DidBenefitBlocks from '../../components/DidBenefitBlocks.vue'

import img1 from '../../assets/did-cover01.jpg'
import img2 from '../../assets/did-cover02.jpg'
import img3 from '../../assets/did-cover03.jpg'
import img4 from '../../assets/did-cover04.jpg'
import img5 from '../../assets/did-cover05.jpg'
import img8 from '../../assets/did-cover08.jpg'

const modules = [EffectFade, Autoplay]

// 셔플 대상은 이미지 슬라이드(cover01~05)만.
const shuffleSlides = [
  { type: 'image', to: '/did/hub', img: img1, delay: 5000 },
  { type: 'image', to: '/did/hub', img: img2, delay: 5000 },
  { type: 'image', to: '/did/hub', img: img3, delay: 5000 },
  { type: 'image', to: '/did/hub', img: img4, delay: 5000 },
  { type: 'image', to: '/did/hub', img: img5, delay: 5000 }
]

// did-cover08 → 버튼(custom) 슬라이드 순서는 고정으로 꼬리에 붙여
// did-cover08이 항상 버튼 영역 바로 앞에 오도록 한다.
const tailSlides = [
  // did-cover08: 클릭해도 이동 없음(to 미지정)
  { type: 'image', img: img8, delay: 5000 },
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

onMounted(() => {
  // 이미지 슬라이드만 셔플하고, did-cover08 + 버튼 슬라이드는 고정 꼬리로 붙임
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