<script setup lang="ts">
import { ref, computed } from 'vue'
import NewsList from '@/components/dashboard/NewsList.vue'
import RamStatus from '@/components/dashboard/RamStatus.vue'

type TabKey = 'news' | 'ram'

const activeTab = ref<TabKey>('news')

const tabs: { key: TabKey; label: string }[] = [
  { key: 'news', label: '오늘의 뉴스' },
  { key: 'ram', label: '램 현황' },
]

const isLoading = ref(false)
const lastCollectedDate = ref('-')
const fetchLabel = computed(() => (activeTab.value === 'news' ? '뉴스 수집' : '가격 조회'))

const keywords: { label: string; value: string }[] = [
  { label: 'KB국민', value: '국민은행' },
  { label: '신한', value: '신한' },
  { label: '농협', value: '농협' },
  { label: '하나', value: '하나은행' },
  { label: '우리', value: '우리은행' },
  { label: 'BNK', value: 'BNK' },
]
const selectedKeyword = ref('')

const selectKeyword = (value: string) => {
  selectedKeyword.value = selectedKeyword.value === value ? '' : value
}

const fetchData = async () => {
  isLoading.value = true
  await new Promise((r) => setTimeout(r, 1200))
  isLoading.value = false
}

const formatLastDate = (dateStr: string): string => {
  if (!dateStr || dateStr === '-') return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
}

const today = new Date().toLocaleDateString('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})
</script>

<template>
  <div class="dashboard">
    <aside class="sidebar">
      <div class="sidebar-inner">
        <div class="sidebar-logo">
          <span class="logo-mark">N</span>
          <span class="logo-text">NewsDigest</span>
        </div>
        <div class="sidebar-section">
          <p class="sidebar-label">현재 메뉴</p>
          <p class="sidebar-value">{{ activeTab === 'news' ? '오늘의 뉴스' : '램 현황' }}</p>
        </div>
        <div class="sidebar-section">
          <p class="sidebar-label">마지막 수집</p>
          <p class="sidebar-value">{{ formatLastDate(lastCollectedDate) }}</p>
        </div>
        <button class="fetch-btn" :disabled="true" @click="fetchData">
          <span class="btn-content">
            <svg :class="{ spin: isLoading }" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2">
              <path v-if="!isLoading" d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path v-else d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            {{ isLoading ? '처리 중...' : fetchLabel }}
          </span>
        </button>
      </div>
    </aside>

    <main class="main-content">
      <header class="content-header">
        <div class="header-left">
          <div class="tab-group">
            <button v-for="tab in tabs" :key="tab.key" class="tab-btn"
              :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
              {{ tab.label }}
            </button>
          </div>
          <p class="page-date">{{ today }}</p>
        </div>
        <Transition name="fade">
          <div v-if="activeTab === 'news'" class="keyword-group">
            <button v-for="kw in keywords" :key="kw.value" class="keyword-btn"
              :class="{ active: selectedKeyword === kw.value }" @click="selectKeyword(kw.value)">
              {{ kw.label }}
            </button>
          </div>
        </Transition>
      </header>

      <div class="section-wrap">
        <Transition name="fade" mode="out-in">
          <NewsList v-if="activeTab === 'news'" key="news" :keyword="selectedKeyword" @lastDate="lastCollectedDate = $event" />
          <RamStatus v-else key="ram" @lastDate="lastCollectedDate = $event" />
        </Transition>
      </div>
    </main>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&family=Noto+Sans+KR:wght@300;400;500&display=swap');

.dashboard { display: flex; height: 100vh; background-color: #f5f2ed; font-family: 'Noto Sans KR', sans-serif; color: #2c2c2c; overflow: hidden; }
.sidebar { width: 240px; min-width: 240px; background-color: #2c3e35; height: 100vh; overflow-y: auto; flex-shrink: 0; }
.sidebar-inner { padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 2rem; height: 100%; }
.sidebar-logo { display: flex; align-items: center; gap: 0.6rem; }
.logo-mark { width: 32px; height: 32px; background-color: #c8a96e; color: #2c3e35; font-family: 'Noto Serif KR', serif; font-weight: 600; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; border-radius: 6px; }
.logo-text { color: #e8e2d9; font-size: 1rem; font-weight: 500; letter-spacing: 0.02em; }
.sidebar-section { display: flex; flex-direction: column; gap: 0.4rem; }
.sidebar-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #7a9080; margin: 0; }
.sidebar-value { font-size: 0.85rem; color: #c8c0b0; margin: 0; }
.fetch-btn { margin-top: auto; padding: 0.85rem 1rem; background-color: #c8a96e; color: #2c3e35; border: none; border-radius: 8px; font-family: 'Noto Sans KR', sans-serif; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: background-color 0.2s, transform 0.1s; }
.fetch-btn:hover:not(:disabled) { background-color: #d4b87a; transform: translateY(-1px); }
.fetch-btn:disabled { opacity: 0.7; cursor: not-allowed; }
.btn-content { display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.main-content { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.content-header { padding: 2.5rem 3rem 1.5rem; border-bottom: 1px solid #e0d8cc; background-color: #f5f2ed; flex-shrink: 0; }
.header-left { display: flex; flex-direction: column; gap: 0.4rem; }
.tab-group { display: flex; gap: 0.2rem; }
.tab-btn { background: none; border: none; cursor: pointer; font-family: 'Noto Serif KR', serif; font-size: 1.6rem; font-weight: 600; letter-spacing: -0.02em; color: #c8bfb0; padding: 0 0.1rem; transition: color 0.2s; line-height: 1.2; }
.tab-btn::after { content: '/'; margin-left: 0.4rem; color: #ddd6cc; font-weight: 300; }
.tab-btn:last-child::after { content: ''; }
.tab-btn.active { color: #1a1a1a; }
.tab-btn:hover:not(.active) { color: #7a6f63; }
.page-date { font-size: 0.82rem; color: #9a8f82; margin: 0; }
.keyword-group { display: flex; flex-wrap: wrap; gap: 0.5rem; padding-top: 0.8rem; }
.keyword-btn { padding: 0.35rem 0.85rem; border: 1px solid #d6cfc4; border-radius: 20px; background: none; font-family: 'Noto Sans KR', sans-serif; font-size: 0.78rem; color: #7a6f63; cursor: pointer; transition: all 0.18s; }
.keyword-btn:hover { border-color: #c8a96e; color: #c8a96e; }
.keyword-btn.active { background-color: #2c3e35; border-color: #2c3e35; color: #e8e2d9; }
.section-wrap { flex: 1; overflow-y: auto; padding-top: 0.5rem; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fade-enter-from { opacity: 0; transform: translateY(6px); }
.fade-leave-to { opacity: 0; transform: translateY(-6px); }
@media (max-width: 768px) {
  .sidebar { display: none; }
  .content-header { padding: 1.5rem 1.2rem 1rem; }
  .tab-btn { font-size: 1.2rem; }
}
</style>
