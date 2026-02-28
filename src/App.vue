<template>
  <div class="app-container">
    <van-nav-bar title="仓库助手" fixed />
    
    <div class="page-content">
      <QRScanner 
        v-show="activeTab === 'scan'" 
        @scan-result="onScanResult"
        @print-label="onPrintLabel"
      />
      <BluetoothPrint 
        v-show="activeTab === 'print'" 
        ref="printRef"
        :initial-content="pendingPrintContent"
      />
    </div>

    <van-tabbar v-model="activeTab" fixed>
      <van-tabbar-item name="scan" icon="scan" badge-type="primary">
        扫码
      </van-tabbar-item>
      <van-tabbar-item name="print" icon="printer">
        打印
      </van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import QRScanner from './components/QRScanner.vue'
import BluetoothPrint from './components/BluetoothPrint.vue'

const activeTab = ref('scan')
const printRef = ref(null)
const pendingPrintContent = ref('')

const onScanResult = (result) => {
  console.log('Scan result:', result)
}

const onPrintLabel = (content) => {
  pendingPrintContent.value = content
  activeTab.value = 'print'
}

watch(activeTab, (newVal) => {
  if (newVal === 'print' && printRef.value) {
    printRef.value.updateContent(pendingPrintContent.value)
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  width: 100%;
}

.app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.page-content {
  flex: 1;
  padding-top: 46px;
  padding-bottom: 50px;
  overflow-y: auto;
}
</style>
