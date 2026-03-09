<script setup lang="ts">
import {ref, computed, onMounted, watch} from 'vue'
import apiClient from '@/api'

type DdrType = 'DDR4' | 'DDR5'
type Capacity = '8GB' | '16GB' | '32GB' | '64GB'

interface RamRecord {
  ramType: string
  ramSize: string
  currentPrice: number
  registerDate: string
  createDateTime: string
}

interface PricePoint {
  label: string
  price: number
}

const emit = defineEmits<{ (e: 'lastDate', value: string): void }>()

const selectedDdr = ref<DdrType>('DDR4')
const selectedCapacity = ref<Capacity>('16GB')

const ddrTypes: DdrType[] = ['DDR4', 'DDR5']
const capacities: Capacity[] = ['8GB', '16GB', '32GB', '64GB']

const rawList = ref<RamRecord[]>([])
const isLoading = ref(false)
const hasError = ref(false)

// API 호출
async function fetchRams() {
  isLoading.value = true
  hasError.value = false
  try {
    const res = await apiClient.post<RamRecord[]>('/api/rams', {
      ramType: selectedDdr.value,
      ramSize: selectedCapacity.value,
    })
    rawList.value = res.data

    const dates = rawList.value.map(r => r.createDateTime).filter(Boolean).sort()
    const latest = dates.length > 0 ? dates[dates.length - 1] : null

    if (latest) {
      emit('lastDate', latest)
    } else {
      emit('lastDate', '-')
    }
  } catch (e) {
    hasError.value = true
    rawList.value = []
    emit('lastDate', '-')
  } finally {
    isLoading.value = false
  }
}

// register_date → "YYYY.MM" 레이블로 변환 후 오름차순 정렬
const chartData = computed<PricePoint[]>(() => {
  const sorted = [...rawList.value].sort(
    (a, b) => new Date(a.registerDate).getTime() - new Date(b.registerDate).getTime()
  )
  return sorted.map(r => {
    const d = new Date(r.registerDate)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return {label: `${yyyy}.${mm}`, price: r.currentPrice}
  })
})

// DDR 또는 용량 변경 시 재조회
watch([selectedDdr, selectedCapacity], () => fetchRams())
onMounted(() => fetchRams())

const svgWidth = 600
const svgHeight = 220
const padLeft = 70
const padRight = 24
const padTop = 20
const padBottom = 36

const minPrice = computed(() =>
  chartData.value.length ? Math.min(...chartData.value.map(d => d.price)) * 0.97 : 0
)
const maxPrice = computed(() =>
  chartData.value.length ? Math.max(...chartData.value.map(d => d.price)) * 1.03 : 1
)

const points = computed(() => {
  const n = chartData.value.length
  if (n === 0) return []
  return chartData.value.map((d, i) => {
    const x = padLeft + (n === 1 ? (svgWidth - padLeft - padRight) / 2 : (i / (n - 1)) * (svgWidth - padLeft - padRight))
    const y = padTop + (1 - (d.price - minPrice.value) / (maxPrice.value - minPrice.value)) * (svgHeight - padTop - padBottom)
    return {x, y, ...d}
  })
})

const polyline = computed(() =>
  points.value.map(p => `${p.x},${p.y}`).join(' ')
)

const areaPath = computed(() => {
  if (points.value.length === 0) return ''
  const first = points.value[0]!
  const last = points.value[points.value.length - 1]!
  const bottom = svgHeight - padBottom
  return `M${first.x},${bottom} ` +
    points.value.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${last.x},${bottom} Z`
})

const yTicks = computed(() => {
  if (chartData.value.length === 0) return []
  const range = maxPrice.value - minPrice.value
  const step = Math.ceil(range / 4 / 1000) * 1000 || 1000
  const ticks = []
  for (let v = Math.ceil(minPrice.value / 1000) * 1000; v <= maxPrice.value; v += step) {
    const y = padTop + (1 - (v - minPrice.value) / (maxPrice.value - minPrice.value)) * (svgHeight - padTop - padBottom)
    ticks.push({v, y})
  }
  return ticks
})

const hoveredIndex = ref<number | null>(null)

const firstPrice = computed(() => chartData.value[0]?.price ?? 0)
const lastPrice = computed(() => chartData.value[chartData.value.length - 1]?.price ?? 0)
const totalChange = computed(() => lastPrice.value - firstPrice.value)
const totalChangeRate = computed(() =>
  firstPrice.value ? ((totalChange.value / firstPrice.value) * 100).toFixed(1) : '0.0'
)
</script>

<template>
  <div class="ram-status">

    <!-- DDR 탭 -->
    <div class="tab-bar">
      <button
        v-for="ddr in ddrTypes"
        :key="ddr"
        class="tab-btn"
        :class="{ active: selectedDdr === ddr }"
        @click="selectedDdr = ddr"
      >
        {{ ddr }}
      </button>
    </div>

    <!-- 용량 서브메뉴 -->
    <div class="capacity-bar">
      <button
        v-for="cap in capacities"
        :key="cap"
        class="cap-btn"
        :class="{ active: selectedCapacity === cap }"
        @click="selectedCapacity = cap"
      >
        {{ cap }}
      </button>
    </div>

    <!-- 요약 정보 -->
    <div class="summary-row">
      <div class="summary-item">
        <span class="summary-label">현재가</span>
        <span class="summary-value">{{ lastPrice.toLocaleString() }}원</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">6개월 변동</span>
        <span
          class="summary-value"
          :class="{ down: totalChange < 0, up: totalChange > 0, flat: totalChange === 0 }"
        >
          <template v-if="totalChange === 0">변동없음</template>
          <template v-else>
            {{ totalChange > 0 ? '▲' : '▼' }}
            {{ Math.abs(totalChange).toLocaleString() }}원 ({{ totalChangeRate }}%)
          </template>
        </span>
      </div>
      <div class="summary-item">
        <span class="summary-label">구분</span>
        <span class="summary-value tag">{{ selectedDdr }} · {{ selectedCapacity }}</span>
      </div>
      <div class="summary-source">출처: 다나와</div>
    </div>

    <!-- 로딩 -->
    <div v-if="isLoading" class="chart-wrap center-msg">
      <span class="msg-text">불러오는 중...</span>
    </div>

    <!-- 오류 -->
    <div v-else-if="hasError" class="chart-wrap center-msg">
      <span class="msg-text error">데이터를 불러오지 못했습니다.</span>
    </div>

    <!-- 데이터 없음 -->
    <div v-else-if="chartData.length === 0" class="chart-wrap center-msg">
      <span class="msg-text">조회된 데이터가 없습니다.</span>
    </div>

    <!-- 라인 차트 -->
    <div v-else class="chart-wrap">
      <svg
        :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
        class="chart-svg"
        @mouseleave="hoveredIndex = null"
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#c8a96e" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#c8a96e" stop-opacity="0.01"/>
          </linearGradient>
        </defs>

        <!-- y축 그리드 -->
        <g v-for="tick in yTicks" :key="tick.v">
          <line
            :x1="padLeft" :y1="tick.y"
            :x2="svgWidth - padRight" :y2="tick.y"
            stroke="#e0d8cc" stroke-width="1" stroke-dasharray="3,3"
          />
          <text
            :x="padLeft - 8" :y="tick.y + 4"
            text-anchor="end"
            font-size="8"
            fill="#b0a494"
          >{{ (tick.v / 1000).toFixed(0) }}k
          </text>
        </g>

        <!-- x축 레이블 (YYYY.MM) -->
        <text
          v-for="(p, i) in points"
          :key="'x' + i"
          :x="p.x" :y="svgHeight - 8"
          text-anchor="middle"
          font-size="8"
          fill="#b0a494"
        >{{ p.label }}
        </text>

        <!-- 영역 채우기 -->
        <path :d="areaPath" fill="url(#areaGrad)"/>

        <!-- 라인 -->
        <polyline
          :points="polyline"
          fill="none"
          stroke="#c8a96e"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <!-- 포인트 & 호버 -->
        <g v-for="(p, i) in points" :key="'p' + i">
          <circle
            :cx="p.x" :cy="p.y" r="14"
            fill="transparent"
            style="cursor: pointer"
            @mouseenter="hoveredIndex = i"
          />
          <circle
            :cx="p.x" :cy="p.y"
            :r="hoveredIndex === i ? 5 : 3.5"
            fill="#c8a96e"
            stroke="#fff"
            :stroke-width="hoveredIndex === i ? 2 : 1.5"
            style="transition: r 0.15s"
          />

          <!-- 툴팁 -->
          <g v-if="hoveredIndex === i">
            <rect
              :x="p.x - 24" :y="p.y - 26"
              width="48" height="16"
              rx="3" ry="3"
              fill="#2c3e35"
            />
            <text
              :x="p.x" :y="p.y - 15"
              text-anchor="middle"
              font-size="7"
              fill="#e8e2d9"
              font-weight="500"
            >{{ p.price.toLocaleString() }}원
            </text>
          </g>
        </g>
      </svg>
    </div>

  </div>
</template>

<style scoped>
.ram-status {
  padding: 0 3rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.tab-bar {
  display: flex;
  gap: 0.5rem;
}

.tab-btn {
  padding: 0.45rem 1.4rem;
  border-radius: 6px;
  border: 1px solid #d0c8bb;
  background: transparent;
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 0.82rem;
  font-weight: 500;
  color: #9a8f82;
  cursor: pointer;
  transition: all 0.18s;
  line-height: 1;
  box-sizing: border-box;
}

.tab-btn.active {
  background-color: #2c3e35;
  border-color: #2c3e35;
  color: #e8e2d9;
}

.tab-btn:hover:not(.active) {
  border-color: #2c3e35;
  color: #2c3e35;
}

.capacity-bar {
  display: flex;
  gap: 0.4rem;
}

.cap-btn {
  padding: 0.35rem 1rem;
  border-radius: 20px;
  border: 1px solid #e0d8cc;
  background: transparent;
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 0.76rem;
  color: #9a8f82;
  cursor: pointer;
  transition: all 0.18s;
  line-height: 1;
  box-sizing: border-box;
}

.cap-btn.active {
  background-color: #c8a96e;
  border-color: #c8a96e;
  color: #fff;
}

.cap-btn:hover:not(.active) {
  border-color: #c8a96e;
  color: #c8a96e;
}

.summary-row {
  display: flex;
  gap: 2rem;
  padding: 0.9rem 1.2rem;
  background-color: rgba(44, 62, 53, 0.04);
  border-radius: 8px;
  border: 1px solid #e0d8cc;
  position: relative;
}

.summary-source {
  position: absolute;
  bottom: 0.45rem;
  right: 0.8rem;
  font-size: 0.62rem;
  color: #b0a494;
  letter-spacing: 0.04em;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.summary-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #9a8f82;
}

.summary-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1a1a1a;
  font-variant-numeric: tabular-nums;
}

.summary-value.down {
  color: #2563a8;
}

.summary-value.up {
  color: #c0392b;
}

.summary-value.flat {
  color: #9a8f82;
}

.summary-value.tag {
  font-size: 0.82rem;
  color: #2c3e35;
}

.chart-wrap {
  width: 100%;
  border: 1px solid #e0d8cc;
  border-radius: 8px;
  padding: 0.6rem 0.4rem 0.2rem;
  box-sizing: border-box;
  background: #fdfaf6;
}

.center-msg {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}

.msg-text {
  font-size: 0.85rem;
  color: #9a8f82;
}

.msg-text.error {
  color: #c0392b;
}

.chart-svg {
  width: 100%;
  height: auto;
  display: block;
}

@media (max-width: 768px) {
  .ram-status {
    padding: 0 1.2rem 2rem;
  }

  .summary-row {
    flex-wrap: wrap;
    gap: 1rem;
  }
}
</style>
