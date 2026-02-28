<template>
  <div class="print-container">
    <van-cell-group inset>
      <van-cell title="蓝牙状态" :value="bluetoothStatus" :value-class="statusClass" />
    </van-cell-group>

    <div v-if="!connectedDevice" class="connect-section">
      <van-empty description="未连接蓝牙打印机">
        <van-button type="primary" round size="large" @click="scanDevices">
          搜索打印机
        </van-button>
      </van-empty>
    </div>

    <div v-else class="connected-section">
      <van-cell-group inset>
        <van-cell title="已连接" :value="connectedDevice.name || '未知设备'" />
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px">
        <van-field
          v-model="printContent"
          type="textarea"
          label="标签内容"
          placeholder="请输入要打印的内容"
          rows="4"
        />
      </van-cell-group>

      <div class="print-actions">
        <van-button type="primary" size="large" @click="printLabel" :loading="printing">
          打印标签
        </van-button>
        <van-button size="large" @click="disconnect" style="margin-top: 12px">
          断开连接
        </van-button>
      </div>
    </div>

    <van-action-sheet
      v-model:show="showDevices"
      title="选择蓝牙打印机"
      :actions="deviceList"
      @select="onSelectDevice"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { showToast } from 'vant'

const props = defineProps({
  initialContent: {
    type: String,
    default: ''
  }
})

const bluetoothStatus = ref('未连接')
const connectedDevice = ref(null)
const deviceList = ref([])
const showDevices = ref(false)
const printing = ref(false)
const printContent = ref('')

const statusClass = computed(() => {
  return connectedDevice.value ? 'status-connected' : 'status-disconnected'
})

let bluetoothDevice = null
let printCharacteristic = null

const scanDevices = async () => {
  try {
    if (!navigator.bluetooth) {
      showToast('当前浏览器不支持蓝牙功能，请使用 Chrome/Edge')
      return
    }

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['00001800-0000-1000-8000-00805f9b34fb', '00001801-0000-1000-8000-00805f9b34fb']
    })

    connectedDevice.value = device
    bluetoothStatus.value = '已连接'
    printContent.value = props.initialContent

    device.addEventListener('gattserverdisconnected', () => {
      connectedDevice.value = null
      bluetoothStatus.value = '已断开'
      showToast('蓝牙连接已断开')
    })

    showToast('连接成功')
  } catch (err) {
    console.error('Bluetooth error:', err)
    if (err.name === 'NotFoundError') {
      showToast('未选择设备')
    } else {
      showToast('连接失败: ' + err.message)
    }
  }
}

const onSelectDevice = async (action) => {
  showDevices.value = false
}

const disconnect = async () => {
  if (connectedDevice.value) {
    await connectedDevice.value.gatt.disconnect()
    connectedDevice.value = null
    bluetoothStatus.value = '未连接'
    showToast('已断开连接')
  }
}

const printLabel = async () => {
  if (!connectedDevice.value) {
    showToast('请先连接蓝牙打印机')
    return
  }

  if (!printContent.value.trim()) {
    showToast('请输入打印内容')
    return
  }

  printing.value = true

  try {
    const server = await connectedDevice.value.gatt.connect()
    const service = await server.getPrimaryService('00001800-0000-1000-8000-00805f9b34fb')
    const characteristic = await service.getCharacteristic('00002a00-0000-1000-8000-00805f9b34fb')

    const labelData = createLabelData(printContent.value)
    await characteristic.writeValue(labelData)

    showToast('打印成功')
  } catch (err) {
    console.error('Print error:', err)
    
    // 尝试使用 ESC/POS 指令打印
    try {
      const server = await connectedDevice.value.gatt.connect()
      const service = await server.getPrimaryService('00001800-0000-1000-8000-00805f9b34fb')
      const characteristic = await service.getCharacteristic('00002a01-0000-1000-8000-00805f9b34fb')
      
      const escposData = createEscPosData(printContent.value)
      await characteristic.writeValue(escposData)
      showToast('打印成功')
    } catch (err2) {
      console.error('ESC/POS error:', err2)
      showToast('打印失败，请重试')
    }
  } finally {
    printing.value = false
  }
}

const createLabelData = (content) => {
  const encoder = new TextEncoder()
  return encoder.encode(content)
}

const createEscPosData = (content) => {
  const commands = []
  
  // ESC/POS 初始化
  commands.push(0x1B, 0x40)
  
  // 居中对齐
  commands.push(0x1B, 0x61, 0x01)
  
  // 放大字体 (2倍)
  commands.push(0x1D, 0x21, 0x11)
  
  // 打印内容
  const textEncoder = new TextEncoder()
  const textBytes = textEncoder.encode(content + '\n')
  commands.push(...textBytes)
  
  // 换行
  commands.push(0x0A, 0x0A, 0x0A)
  
  // 切纸
  commands.push(0x1D, 0x56, 0x00)
  
  return new Uint8Array(commands)
}

const updateContent = (content) => {
  printContent.value = content
}

defineExpose({
  updateContent,
  connectedDevice
})
</script>

<style scoped>
.print-container {
  padding: 16px;
  height: 100%;
  background: #f5f5f5;
}

.connect-section,
.connected-section {
  margin-top: 24px;
}

.print-actions {
  margin-top: 24px;
  padding: 0 16px;
}

.status-connected {
  color: #07c160;
}

.status-disconnected {
  color: #969799;
}
</style>
