<script setup lang="ts">
import ErrorPage from '@/components/error/ErrorPage.vue'
</script>

<template>
  <ErrorPage
    code="500"
    title="서버 오류가 발생했습니다"
    description="일시적인 서버 오류입니다. 잠시 후 다시 시도해주세요."
  />
</template>
