<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { fetchNewsList, fetchSummary, getSummaryStreamUrl } from '@/api'
import type { NewsItem } from '@/api'

interface DisplayNewsItem {
  id: number
  title: string
  media: string
  writeDateTime: string
  url: string
  createDateTime: string
}

const props = defineProps<{ keyword: string }>()
const emit = defineEmits<{ (e: 'lastDate', date: string): void }>()

const newsList = ref<DisplayNewsItem[]>([])
const expandedId = ref<number | null>(null)
const summaryMap = ref<Record<number, string | null>>({})
const summaryLoadingSet = ref(new Set<number>())
const isLoading = ref(false)
const errorMsg = ref<string | null>(null)

const fetchNews = async () => {
  isLoading.value = true
  errorMsg.value = null
  expandedId.value = null
  try {
    const data = await fetchNewsList(props.keyword)
    newsList.value = data.map((item: NewsItem) => ({
      id: item.id,
      title: item.title,
      media: item.media,
      writeDateTime: item.write_date_time,
      url: item.url,
      createDateTime: item.create_date_time,
    }))
    if (data.length > 0) {
      const latest = data.reduce((a: NewsItem, b: NewsItem) =>
        new Date(a.create_date_time) > new Date(b.create_date_time) ? a : b
      )
      emit('lastDate', latest.create_date_time)
    }
  } catch (_) {
    errorMsg.value = '뉴스를 불러오는 데 실패했습니다.'
  } finally {
    isLoading.value = false
  }
}

watch(() => props.keyword, fetchNews)

const fetchSummaryForItem = async (item: DisplayNewsItem) => {
  if (summaryMap.value[item.id] !== undefined) return
  try {
    const result = await fetchSummary(item.id)
    summaryMap.value = { ...summaryMap.value, [item.id]: result }
  } catch (_) {
    summaryMap.value = { ...summaryMap.value, [item.id]: null }
  }
}

const generateSummary = async (item: DisplayNewsItem) => {
  summaryLoadingSet.value = new Set(summaryLoadingSet.value.add(item.id))
  summaryMap.value = { ...summaryMap.value, [item.id]: '' }

  const streamUrl = getSummaryStreamUrl(item.id, item.url, item.title)
  const eventSource = new EventSource(streamUrl)

  eventSource.onmessage = (e) => {
    const chunk = e.data
    if (chunk === '[DONE]') {
      const next = new Set(summaryLoadingSet.value)
      next.delete(item.id)
      summaryLoadingSet.value = next
      eventSource.close()
      return
    }
    if (chunk === '[ERROR]') {
      summaryMap.value = { ...summaryMap.value, [item.id]: '현재 요약을 제공할 수 없습니다.' }
      const next = new Set(summaryLoadingSet.value)
      next.delete(item.id)
      summaryLoadingSet.value = next
      eventSource.close()
      return
    }
    summaryMap.value = { ...summaryMap.value, [item.id]: (summaryMap.value[item.id] ?? '') + chunk }
  }

  eventSource.onerror = () => {
    if ((summaryMap.value[item.id] ?? '').length === 0) {
      summaryMap.value = { ...summaryMap.value, [item.id]: '현재 요약을 제공할 수 없습니다.' }
    }
    const next = new Set(summaryLoadingSet.value)
    next.delete(item.id)
    summaryLoadingSet.value = next
    eventSource.close()
  }
}

const toggleRow = (item: DisplayNewsItem) => {
  if (expandedId.value === item.id) {
    expandedId.value = null
  } else {
    expandedId.value = item.id
    fetchSummaryForItem(item)
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

onMounted(fetchNews)

defineExpose({ count: () => newsList.value.length })
</script>

<template>
  <div class="news-list">
    <!-- 로딩 -->
    <div v-if="isLoading" class="state-wrap">
      <svg class="spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span>불러오는 중...</span>
    </div>

    <!-- 오류 -->
    <div v-else-if="errorMsg" class="state-wrap error">
      {{ errorMsg }}
    </div>

    <!-- 데이터 없음 -->
    <div v-else-if="newsList.length === 0" class="state-wrap">
      수집된 뉴스가 없습니다.
    </div>

    <!-- 목록 -->
    <template v-else>
      <div
        v-for="(item, index) in newsList"
        :key="item.id"
        class="news-item"
        :class="{ expanded: expandedId === item.id }"
      >
        <div class="news-row" @click="toggleRow(item)">
          <div class="news-index">{{ String(index + 1).padStart(2, '0') }}</div>
          <div class="news-info">
            <span class="news-source">{{ item.media }}</span>
            <h2 class="news-title">{{ item.title }}</h2>
          </div>
          <div class="news-meta">
            <span class="news-date">{{ formatDate(item.writeDateTime) }}</span>
            <span class="toggle-icon" :class="{ open: expandedId === item.id }">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </div>
        </div>

        <Transition name="expand">
          <div v-if="expandedId === item.id" class="news-summary">
            <div class="summary-inner">
              <div class="summary-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                AI 요약
              </div>
              <template v-if="(summaryMap[item.id] !== null && summaryMap[item.id] !== undefined && summaryMap[item.id] !== '') || summaryLoadingSet.has(item.id)">
                <p class="summary-text">
                  <span v-html="summaryMap[item.id]"></span><span v-if="summaryLoadingSet.has(item.id)" class="streaming-cursor">▌</span>
                </p>
              </template>
              <div v-else-if="summaryLoadingSet.has(item.id)" class="summary-loading">
                <svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                요약 중...
              </div>
              <template v-else>
                <div class="summary-actions">
                  <button class="generate-btn" @click.stop="generateSummary(item)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    AI 요약하기
                  </button>
                  <a :href="item.url" target="_blank" rel="noopener noreferrer" class="news-link" @click.stop>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                    기사 원문
                  </a>
                </div>
              </template>
              <a v-if="summaryMap[item.id] && !summaryLoadingSet.has(item.id)" :href="item.url" target="_blank" rel="noopener noreferrer" class="news-link" @click.stop>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                </svg>
                기사 원문
              </a>
            </div>
          </div>
        </Transition>
      </div>
    </template>
  </div>
</template>

<style scoped>
.news-list {
  padding: 0 3rem 3rem;
}

.state-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  padding: 4rem 0;
  color: #9a8f82;
  font-size: 0.9rem;
}

.state-wrap.error {
  color: #c0392b;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.news-item {
  border-bottom: 1px solid #e0d8cc;
  overflow: hidden;
}

.news-row {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 1.4rem 0;
  cursor: pointer;
  transition: background-color 0.15s, padding 0.15s;
  border-radius: 4px;
}

.news-row:hover {
  background-color: rgba(200, 169, 110, 0.07);
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  margin: 0 -0.5rem;
}

.news-index {
  font-size: 0.75rem;
  color: #c8a96e;
  font-weight: 500;
  min-width: 24px;
  font-variant-numeric: tabular-nums;
}

.news-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.news-source {
  font-size: 0.72rem;
  color: #9a8f82;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.news-title {
  font-family: 'Noto Serif KR', serif;
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.news-item.expanded .news-title {
  white-space: normal;
  color: #2c3e35;
}

.news-meta {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-shrink: 0;
}

.news-date {
  font-size: 0.75rem;
  color: #b0a494;
}

.toggle-icon {
  color: #b0a494;
  display: flex;
  align-items: center;
  transition: transform 0.25s ease;
}

.toggle-icon.open {
  transform: rotate(180deg);
  color: #2c3e35;
}

.news-summary {
  overflow: hidden;
}

.summary-inner {
  padding: 0 0 1.4rem 2.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.summary-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #2c3e35;
}

.summary-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #9a8f82;
}

.summary-text {
  font-size: 0.9rem;
  line-height: 1.8;
  color: #4a4a4a;
  margin: 0;
  background-color: rgba(44, 62, 53, 0.04);
  border-left: 3px solid #c8a96e;
  padding: 0.8rem 1rem;
  border-radius: 0 6px 6px 0;
  overflow: hidden;
  word-break: break-word;
  box-sizing: border-box;
}

.summary-text :deep(*) {
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

.summary-text :deep(h1),
.summary-text :deep(h2),
.summary-text :deep(h3) {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.6rem 0 0.3rem;
  color: #2c3e35;
}

.summary-text :deep(ul),
.summary-text :deep(ol) {
  padding-left: 1.2rem;
  margin: 0.4rem 0;
}

.summary-text :deep(li) {
  margin-bottom: 0.3rem;
}

.summary-text :deep(p) {
  margin: 0.4rem 0;
}

.summary-text :deep(strong) {
  color: #2c3e35;
}

.news-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  font-family: 'Noto Sans KR', sans-serif;
  color: #c8a96e;
  text-decoration: none;
  border: 1px solid #c8a96e;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  transition: background-color 0.2s, color 0.2s;
  line-height: 1;
  box-sizing: border-box;
  height: 2rem;
  vertical-align: middle;
}

.news-link:hover {
  background-color: #c8a96e;
  color: #2c3e35;
}

.summary-actions {
  display: flex;
  align-items: stretch;
  gap: 0.6rem;
}

.generate-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  background-color: #2c3e35;
  color: #e8e2d9;
  border: 1px solid #2c3e35;
  border-radius: 6px;
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 0.78rem;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
  line-height: 1;
  box-sizing: border-box;
  height: 2rem;
}

.generate-btn:hover {
  background-color: transparent;
  color: #2c3e35;
}

.streaming-cursor {
  display: inline;
  color: #c8a96e;
  font-weight: bold;
  animation: blink 0.8s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.expand-enter-active,
.expand-leave-active {
  transition: max-height 0.3s ease, opacity 0.25s ease;
  max-height: 400px;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

@media (max-width: 768px) {
  .news-list {
    padding: 0 1.2rem 2rem;
  }
}

@media (max-width: 480px) {
  .news-date { display: none; }
  .news-title { font-size: 0.92rem; }
}
</style>
