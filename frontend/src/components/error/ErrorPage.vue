<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = defineProps<{
  code: string | number
  title: string
  description: string
}>()

const router = useRouter()
</script>

<template>
  <div class="error-page">
    <div class="content">
      <div class="error-code">{{ props.code }}</div>
      <div class="divider" />
      <div class="message-block">
        <h1 class="title">{{ props.title }}</h1>
        <p class="description">{{ props.description }}</p>
      </div>
      <button class="home-btn" @click="router.push('/')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12L12 3l9 9M9 21V12h6v9" />
        </svg>
        홈으로 돌아가기
      </button>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&family=Noto+Sans+KR:wght@300;400;500&display=swap');

.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f5f2ed;
  font-family: 'Noto Sans KR', sans-serif;
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  text-align: center;
  padding: 2rem;
  animation: fadeUp 0.5s ease both;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

.error-code {
  font-family: 'Noto Serif KR', serif;
  font-size: clamp(5rem, 15vw, 9rem);
  font-weight: 600;
  color: #2c3e35;
  line-height: 1;
  letter-spacing: -0.04em;
  opacity: 0.15;
}

.divider {
  width: 48px;
  height: 2px;
  background-color: #c8a96e;
  border-radius: 2px;
}

.message-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.title {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.4rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.description {
  font-size: 0.88rem;
  color: #9a8f82;
  margin: 0;
}

.home-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.75rem 1.5rem;
  background-color: #2c3e35;
  color: #e8e2d9;
  border: none;
  border-radius: 8px;
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
}

.home-btn:hover {
  background-color: #3a5246;
  transform: translateY(-1px);
}

.home-btn:active {
  transform: translateY(0);
}
</style>
