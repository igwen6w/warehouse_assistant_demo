<template>
  <div class="print-container">
    <van-cell-group inset>
      <van-cell title="蓝牙状态" :value="bluetoothStatus" :value-class="statusClass" />
    </van-cell-group>

    <!-- iOS 提示 -->
    <van-cell-group inset v-if="isIOS" style="margin-top: 12px">
      <van-cell>
        <template #title>
          <div class="ios-warning">
            <van-icon name="warning-o" size="20" />
            <span style="margin-left: 8px">iOS Safari 不支持 Web Bluetooth</span>
          </div>
        </template>
      </van-cell>
      <van-cell title="解决方案" label="请使用 Chrome 浏览器(Android) 或安装自定义应用" />
    </van-cell-group>

    <div v-if="!connectedDevice && !isIOS" class="connect-section">
      <van-empty description="未连接蓝牙打印机">
        <van-button type="primary" round size="large" @click="scanDevices">
          搜索打印机
        </van-button>
      </van-empty>
    </div>

    <div v-else-if="connectedDevice" class="connected-section">
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
import { ref, computed, onMounted } from 'vue'
import { showToast, showConfirmDialog } from 'vant'

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
const isIOS = ref(false)

const statusClass = computed(() => {
  return connectedDevice.value ? 'status-connected' : 'status-disconnected'
})

let bluetoothDevice = null
let printCharacteristic = null

// 检测 iOS
const detectIOS = () => {
  const ua = navigator.userAgent
  isIOS.value = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
}

const scanDevices = async () => {
  // 先检测 iOS
  detectIOS()
  
  if (isIOS.value) {
    showConfirmDialog({
      title: '不支持的浏览器',
      message: 'iOS Safari 不支持 Web Bluetooth API。请使用以下方案：\n1. 使用 Android 设备的 Chrome 浏览器\n2. 将应用打包为原生 iOS 应用\n3. 使用 BLE 硬件串口模块',
      confirmButtonText: '知道了'
    })
    return
  }

  if (!navigator.bluetooth) {
    showToast('当前浏览器不支持蓝牙功能，请使用 Chrome 浏览器')
    return
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['00001800-0000-1000-8000-00805f9b34fb', '00001801-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455']
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
    } else if (err.name === 'SecurityError') {
      showToast('蓝牙功能被禁用，请在浏览器设置中启用')
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
    try {
      await connectedDevice.value.gatt.disconnect()
    } catch (e) {
      console.error('Disconnect error:', e)
    }
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
    
    // 尝试多个常见的 BLE 打印服务 UUID
    const serviceUUIDs = [
      '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Nordic UART
      '00001800-0000-1000-8000-00805f9b34fb', // GAP
      '00001801-0000-1000-8000-00805f9b34fb'  // GATT
    ]

    let service = null
    for (const uuid of serviceUUIDs) {
      try {
        service = await server.getPrimaryService(uuid)
        if (service) break
      } catch (e) {
        continue
      }
    }

    if (!service) {
      // 尝试获取任何可用的服务
      const services = await server.getPrimaryServices()
      service = services[0]
    }

    if (service) {
      const characteristics = await service.getCharacteristics()
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          printCharacteristic = char
          break
        }
      }
    }

    if (!printCharacteristic) {
      throw new Error('未找到可写入的特征')
    }

    const escposData = createEscPosData(printContent.value)
    await printCharacteristic.writeValue(escposData)
    
    showToast('打印成功')
  } catch (err) {
    console.error('Print error:', err)
    showToast('打印失败，请确保打印机支持 BLE 连接')
  } finally {
    printing.value = false
  }
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

onMounted(() => {
  detectIOS()
  if (isIOS.value) {
    bluetoothStatus.value = 'iOS 不支持'
  }
})

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

.ios-warning {
  display: flex;
  align-items: center;
  color: #ff976a;
}
</style>
