<script setup lang="ts">
import ErrorPage from '@/components/error/ErrorPage.vue'
</script>

<template>
  <ErrorPage
    code="404"
    title="페이지를 찾을 수 없습니다"
    description="요청하신 페이지가 존재하지 않거나 삭제되었습니다."
  />
</template>
