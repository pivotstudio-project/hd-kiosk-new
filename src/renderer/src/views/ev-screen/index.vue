<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, EffectFade } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-fade'

const modules = [EffectFade, Autoplay]

// 각 슬라이드별 개별 딜레이 (ms)
const slideDelays = [30000, 15000, 95000]

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
  const delay = slideDelays[index] || 5000

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
    :autoplay="{ delay: slideDelays[0], disableOnInteraction: false }"
    @swiper="onSwiper"
    @slide-change-transition-end="onSlideChange"
  >
    <swiper-slide>
      <router-link to="/ev-screen/hub" class="page-ev-screen">
        <video autoplay muted playsinline loop>
          <source src="/video-cover.mp4" type="video/mp4" />
        </video>
      </router-link>
    </swiper-slide>
    <swiper-slide>
      <router-link to="/ev-screen/hub" class="page-ev-screen">
        <video autoplay muted playsinline loop>
          <source src="/video-cover02.mp4" type="video/mp4" />
        </video>
      </router-link>
    </swiper-slide>
    <swiper-slide>
      <router-link to="/ev-screen/hub" class="page-ev-screen">
        <video autoplay muted playsinline loop>
          <source src="/video-cover03.mp4" type="video/mp4" />
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
