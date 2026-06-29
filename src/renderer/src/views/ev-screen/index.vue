<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, EffectFade } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-fade'

const modules = [EffectFade, Autoplay]

// 슬라이드별 영상 + 딜레이(ms). delay는 각 영상 길이에 맞춰 한 번 재생 후 다음으로 전환
const videoSlides = [
  { src: '/video-cover.mp4', delay: 30000 },
  { src: '/video-cover02.mp4', delay: 15000 },
  { src: '/video-cover03.mp4', delay: 95000 },
  { src: '/video-cover04.mp4', delay: 30000 },
  { src: '/video-cover05.mp4', delay: 30000 },
  { src: '/video-cover06.mp4', delay: 60000 },
  { src: '/video-cover07.mp4', delay: 30000 },
  { src: '/video-cover08.mp4', delay: 30000 },
  { src: '/video-cover09.mp4', delay: 60000 },
  { src: '/video-cover10.mp4', delay: 228000 },
  { src: '/video-cover11.mp4', delay: 135000 }
]

// Swiper 인스턴스 참조
const swiperRef = ref<any>(null)

const onSwiper = (swiper: any): void => {
  swiperRef.value = swiper
}

// 현재 활성화된 슬라이드의 비디오 재생
const playCurrentVideo = (swiper: any): void => {
  const activeSlide = swiper.slides[swiper.activeIndex]
  const video = activeSlide.querySelector('video') as HTMLVideoElement
  if (video) {
    video.currentTime = 0
    video.play().catch(() => {})
  }
}

// 모든 비디오 정지
const pauseAllVideos = (): void => {
  if (!swiperRef.value) return

  const videos = swiperRef.value.el.querySelectorAll('video') as NodeListOf<HTMLVideoElement>
  videos.forEach((video) => {
    video.pause()
    video.currentTime = 0
  })
}

// Swiper 자동재생 정지
const stopAutoplay = (): void => {
  if (swiperRef.value?.autoplay) {
    swiperRef.value.autoplay.stop()
  }
}

// 슬라이드 변경 시 딜레이와 비디오 제어
const onSlideChange = (swiper: any): void => {
  const index = swiper.realIndex
  const delay = videoSlides[index]?.delay || 5000

  // autoplay delay 업데이트
  swiper.params.autoplay.delay = delay
  swiper.autoplay.start()

  // 비디오 재생
  playCurrentVideo(swiper)
}

onMounted(() => {
  // 최초 실행시에도 비디오 재생
  if (swiperRef.value) {
    playCurrentVideo(swiperRef.value)
  }
})

// 컴포넌트가 언마운트되기 전에 정리
onBeforeUnmount(() => {
  console.log('Swiper 컴포넌트 정리 중...')

  // 1. 모든 비디오 정지
  pauseAllVideos()

  // 2. Swiper 자동재생 정지
  stopAutoplay()

  // 3. Swiper 인스턴스 정리 (선택사항)
  if (swiperRef.value) {
    swiperRef.value.destroy(true, true) // (deleteInstance, cleanStyles)
    swiperRef.value = null
  }
})
</script>

<template>
  <swiper
    class="mySwiper"
    loop
    effect="fade"
    :modules="modules"
    :autoplay="{ delay: videoSlides[0].delay, disableOnInteraction: false }"
    @swiper="onSwiper"
    @slide-change-transition-end="onSlideChange"
  >
    <swiper-slide v-for="(v, idx) in videoSlides" :key="idx">
      <router-link to="/ev-screen/hub" class="page-ev-screen">
        <video autoplay muted playsinline loop>
          <source :src="v.src" type="video/mp4" />
        </video>
      </router-link>
    </swiper-slide>
  </swiper>
</template>

<style scoped>
video {
  pointer-events: none;
}
</style>
