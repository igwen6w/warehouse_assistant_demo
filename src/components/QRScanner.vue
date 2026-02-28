<template>
  <div class="scanner-container" ref="scannerRef">
    <div class="scanner-wrapper" v-show="isScanning">
      <video 
        ref="videoRef" 
        class="scanner-video" 
        playsinline
      ></video>
      <canvas ref="canvasRef" class="scanner-canvas"></canvas>
      <div class="scanner-overlay">
        <div class="scan-frame">
          <div class="corner tl"></div>
          <div class="corner tr"></div>
          <div class="corner bl"></div>
          <div class="corner br"></div>
          <div class="scan-line"></div>
        </div>
      </div>
    </div>

    <div class="result-section" v-if="scanResult">
      <van-cell-group inset>
        <van-cell title="扫描结果" :value="scanTime" />
        <van-cell title="内容" :label="scanResult" />
      </van-cell-group>
      <div class="action-buttons">
        <van-button type="primary" size="large" @click="handlePrint">
          打印标签
        </van-button>
        <van-button size="large" @click="handleScanAgain" style="margin-top: 12px">
          继续扫描
        </van-button>
      </div>
    </div>

    <div class="start-scan" v-if="!isScanning && !scanResult">
      <van-empty description="点击下方按钮开始扫描二维码">
        <van-button type="primary" round size="large" @click="startScan">
          开始扫描
        </van-button>
      </van-empty>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { showToast } from 'vant'
import jsQR from 'jsqr'
import 'webrtc-adapter'

const emit = defineEmits(['scan-result'])

const isScanning = ref(false)
const scanResult = ref('')
const scanTime = ref('')
const scannerRef = ref(null)
const videoRef = ref(null)
const canvasRef = ref(null)

let stream = null
let animationFrame = null
let previousCode = null
let parity = 0

const formatTime = () => {
  const now = new Date()
  return now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const startScan = async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('当前浏览器不支持摄像头调用')
      return
    }

    previousCode = null
    parity = 0
    
    const canvas = canvasRef.value
    const ctx = canvas.getContext('2d')
    
    // 使用后置摄像头
    const facingMode = { exact: 'environment' }
    
    const handleSuccess = (mediaStream) => {
      stream = mediaStream
      
      if (videoRef.value.srcObject !== undefined) {
        videoRef.value.srcObject = stream
      } else if (videoRef.value.mozSrcObject !== undefined) {
        videoRef.value.mozSrcObject = stream
      } else if (window.URL.createObjectURL) {
        videoRef.value.src = window.URL.createObjectURL(stream)
      } else if (window.webkitURL) {
        videoRef.value.src = window.webkitURL.createObjectURL(stream)
      } else {
        videoRef.value.src = stream
      }
      
      // 关键：设置 playsInline 防止 iOS 全屏
      videoRef.value.playsInline = true
      
      const playPromise = videoRef.value.play()
      playPromise.catch(() => {
        showToast('请在浏览器设置中允许自动播放')
      })
      playPromise.then(() => {
        isScanning.value = true
        scanQRCode()
      })
    }

    // 先尝试后置摄像头
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode } })
      .then(handleSuccess)
      .catch(() => {
        // 后置摄像头失败，尝试任意摄像头
        navigator.mediaDevices
          .getUserMedia({ video: true })
          .then(handleSuccess)
          .catch((error) => {
            console.error('Camera error:', error)
            showToast('无法访问相机，请检查权限设置')
          })
      })
  } catch (err) {
    console.error('Camera error:', err)
    showToast('无法访问相机: ' + err.message)
  }
}

const scanQRCode = () => {
  if (!videoRef.value || !canvasRef.value || !isScanning.value) return

  const video = videoRef.value
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      })

      if (code && code.data) {
        // 防止重复触发
        if (previousCode !== code.data) {
          previousCode = code.data
        } else if (previousCode === code.data) {
          parity += 1
        }
        
        if (parity > 2) {
          scanResult.value = code.data
          scanTime.value = formatTime()
          stopScan()
          emit('scan-result', code.data)
          parity = 0
          return
        }
      }
    } catch (err) {
      // 静默处理解码错误
    }
  }

  animationFrame = requestAnimationFrame(scanQRCode)
}

const stopScan = async () => {
  isScanning.value = false
  
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }

  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }

  if (videoRef.value && videoRef.value.srcObject) {
    videoRef.value.srcObject.getTracks().forEach(t => t.stop())
    videoRef.value.srcObject = null
  }
}

const handleScanAgain = () => {
  scanResult.value = ''
  scanTime.value = ''
  previousCode = null
  parity = 0
  startScan()
}

const handlePrint = () => {
  emit('print-label', scanResult.value)
}

onUnmounted(() => {
  stopScan()
})
</script>

<style scoped>
.scanner-container {
  height: 100%;
  background: #000;
}

.scanner-wrapper {
  position: relative;
  width: 100%;
  height: 350px;
  background: #000;
  overflow: hidden;
}

.scanner-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scanner-canvas {
  display: none;
}

.scanner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.scan-frame {
  width: 250px;
  height: 250px;
  position: relative;
}

.corner {
  position: absolute;
  width: 30px;
  height: 30px;
  border-color: #1989fa;
  border-style: solid;
}

.tl {
  top: 0;
  left: 0;
  border-width: 4px 0 0 4px;
}

.tr {
  top: 0;
  right: 0;
  border-width: 4px 4px 0 0;
}

.bl {
  bottom: 0;
  left: 0;
  border-width: 0 0 4px 4px;
}

.br {
  bottom: 0;
  right: 0;
  border-width: 0 4px 4px 0;
}

.scan-line {
  position: absolute;
  top: 50%;
  left: 10px;
  right: 10px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #1989fa, transparent);
  animation: scan 2s linear infinite;
}

@keyframes scan {
  0% {
    top: 10px;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    top: 240px;
    opacity: 0;
  }
}

.result-section {
  padding: 16px;
}

.action-buttons {
  padding: 16px;
}

.start-scan {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}
</style>
