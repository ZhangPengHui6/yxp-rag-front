<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ECharts } from 'echarts/core'

echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{
  data: { date: string; ingested: number; published: number }[]
}>()

const wrap = ref<HTMLDivElement>()
let chart: ECharts | null = null
let observer: ResizeObserver | null = null

function render() {
  if (!wrap.value) return
  if (!chart) chart = echarts.init(wrap.value)
  chart.setOption({
    grid: { left: 32, right: 12, top: 18, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#16191e',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 11 }
    },
    legend: {
      right: 0,
      top: 0,
      itemWidth: 8,
      itemHeight: 8,
      icon: 'circle',
      textStyle: { color: '#6b7280', fontSize: 11 }
    },
    xAxis: {
      type: 'category',
      data: props.data.map((d) => d.date),
      axisLine: { lineStyle: { color: '#e7e9ee' } },
      axisTick: { show: false },
      axisLabel: { color: '#9aa1ac', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f0f2f5' } },
      axisLabel: { color: '#9aa1ac', fontSize: 11 }
    },
    series: [
      {
        name: '入库条目',
        type: 'bar',
        barWidth: 14,
        itemStyle: { color: '#0f6b5c', borderRadius: [4, 4, 0, 0] },
        data: props.data.map((d) => d.ingested)
      },
      {
        name: '发布条目',
        type: 'line',
        smooth: true,
        symbolSize: 5,
        lineStyle: { color: '#175cd3', width: 2 },
        itemStyle: { color: '#175cd3' },
        data: props.data.map((d) => d.published)
      }
    ]
  })
}

watch(() => props.data, render, { deep: true })

onMounted(() => {
  render()
  observer = new ResizeObserver(() => chart?.resize())
  if (wrap.value) observer.observe(wrap.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="wrap" class="trend-chart" />
</template>

<style scoped>
.trend-chart {
  width: 100%;
  height: 240px;
}
</style>
