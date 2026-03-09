<script setup lang="ts">
import ErrorPage from '@/components/error/ErrorPage.vue'
</script>

<template>
  <ErrorPage
    code="403"
    title="접근 권한이 없습니다"
    description="이 페이지에 접근할 수 있는 권한이 없습니다."
  />
</template>
