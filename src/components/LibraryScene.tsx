'use client'

import { useRef, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AppState } from './Library'

interface Props {
  appState: AppState
  setAppState: (s: AppState) => void
  keywords: string[]
  summary: string
  words: string[]
}

const BALLOON_COLORS = [
  '#d40005', '#ff5100', '#11d0be', '#ffc000',
  '#03842f', '#3004ca', '#6eca00', '#ff005b',
  '#ff006b', '#0637ff', '#00b4e1', '#8305d1',
]

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#',''), 16)
  const r = Math.min(255, (num >> 16) + Math.round(255 * amount))
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount))
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount))
  return `rgb(${r},${g},${b})`
}

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#',''), 16)
  const r = Math.max(0, (num >> 16) - Math.round(255 * amount))
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * amount))
  const b = Math.max(0, (num & 0xff) - Math.round(255 * amount))
  return `rgb(${r},${g},${b})`
}

function createBalloonTexture(color: string, label?: string, large?: boolean): THREE.Texture {
  const size = large ? 512 : 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size * 1.2
  const ctx = canvas.getContext('2d')!

  const grad = ctx.createRadialGradient(
    size * 0.38, size * 0.32, size * 0.02,
    size * 0.5,  size * 0.48, size * 0.46
  )
  grad.addColorStop(0,   lighten(color, 0.5))
  grad.addColorStop(0.3, lighten(color, 0.15))
  grad.addColorStop(0.7, color)
  grad.addColorStop(1,   darken(color, 0.25))

  ctx.beginPath()
  ctx.ellipse(size/2, size*0.46, size*0.42, size*0.44, 0, 0, Math.PI*2)
  ctx.fillStyle = grad
  ctx.fill()

  const gloss1 = ctx.createRadialGradient(
    size*0.36, size*0.26, 0,
    size*0.36, size*0.26, size*0.2
  )
  gloss1.addColorStop(0, 'rgba(255,255,255,0.55)')
  gloss1.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.beginPath()
  ctx.ellipse(size*0.36, size*0.27, size*0.18, size*0.13, -0.4, 0, Math.PI*2)
  ctx.fillStyle = gloss1
  ctx.fill()

  const gloss2 = ctx.createRadialGradient(
    size*0.55, size*0.18, 0,
    size*0.55, size*0.18, size*0.07
  )
  gloss2.addColorStop(0, 'rgba(255,255,255,0.4)')
  gloss2.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.beginPath()
  ctx.ellipse(size*0.55, size*0.18, size*0.06, size*0.04, 0, 0, Math.PI*2)
  ctx.fillStyle = gloss2
  ctx.fill()

  // ラベル（キーワード）
  if (label) {
    const fontSize = large ? size * 0.12 : size * 0.12
    ctx.font = `bold ${size * 0.12}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(0,0,0)'

    ctx.shadowBlur = large ? 8 : 4
    // 長いテキストは折り返す
    const maxWidth = size * 0.7
    const words = label.split(' ')
    if (words.length === 1 || ctx.measureText(label).width < maxWidth) {
      ctx.fillText(label, size * 0.5, size * 0.46)
    } else {
      ctx.fillText(words[0], size * 0.5, size * 0.40)
      ctx.fillText(words.slice(1).join(' '), size * 0.5, size * 0.52)
    }
    ctx.shadowBlur = 0
  }

  // 結び目
  ctx.beginPath()
  ctx.arc(size*0.5, size*0.91, size*0.035, 0, Math.PI*2)
  ctx.fillStyle = darken(color, 0.25)
  ctx.fill()

  // 1本の紐部分
  ctx.beginPath()
  ctx.moveTo(size*0.5, size*0.945)
  ctx.quadraticCurveTo(size*0.54, size*1.08, size*0.5, size*1.18)
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = large ? 3 : 1.5
  ctx.lineCap = 'round'
  ctx.stroke()

  return new THREE.CanvasTexture(canvas)
}

interface BalloonData {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  speed: number
  wobble: number
  colorIdx: number
  scale: number
  opacity: number
  isKeyword: boolean
  isPopped: boolean
  popTime: number
  keywordOrder: number
  upgradedTexture: boolean
}

const IDLE_COUNT = 5
const DISSOLUTION_COUNT = 70

export default function LibraryScene({ appState, setAppState, keywords, summary, words }: Props) {
  const timeRef = useRef(0)
  const stateTimeRef = useRef(0)

  const idleRefs = useRef<THREE.Sprite[]>([])
  const dissolutionRefs = useRef<THREE.Sprite[]>([])

  const [idleTextures, setIdleTextures] = useState<THREE.Texture[]>([])
  const [dissolutionTextures, setDissolutionTextures] = useState<THREE.Texture[]>([])

  const idleData = useRef<BalloonData[]>(
    Array.from({ length: IDLE_COUNT }, (_, i) => ({
      x: (Math.random() - 0.5) * 8,
      y: -5 + Math.random() * 3,
      z: 0.5,
      vx: 0,
      vy: 0,
      speed: 0.008 + Math.random() * 0.005,
      wobble: Math.random() * Math.PI * 2,
      colorIdx: i % BALLOON_COLORS.length,
      scale: 0.5 + Math.random() * 0.3,
      opacity: 0.82,
      isKeyword: false,
      isPopped: false,
      popTime: 0,
      keywordOrder: -1,
      upgradedTexture: false,
    }))
  )

  const dissolutionData = useRef<BalloonData[]>([])

  useEffect(() => {
    setIdleTextures(BALLOON_COLORS.map(c => createBalloonTexture(c)))
  }, [])

  useEffect(() => {
    if (keywords.length === 0) return
    const allWords = [...keywords, ...words].slice(0, DISSOLUTION_COUNT)
    // 足りない場合はwordsをループで補完
    while (allWords.length < DISSOLUTION_COUNT) {
      allWords.push(words[allWords.length % words.length] || keywords[allWords.length % keywords.length])
    }

    const textures = allWords.map((word, i) => {
      const colorIdx = i % BALLOON_COLORS.length
      const color = BALLOON_COLORS[colorIdx]
      return createBalloonTexture(color, word)
    })
    setDissolutionTextures(textures)

    dissolutionData.current = Array.from({ length: DISSOLUTION_COUNT }, (_, i) => ({
      x: (Math.random() - 0.5) * 12,
      y: (Math.random() - 0.5) * 8,
      z: (Math.random() - 0.5) * 2,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.12,
      speed: 0,
      wobble: Math.random() * Math.PI * 2,
      colorIdx: i % BALLOON_COLORS.length,
      scale: 1.0 + Math.random() * 0.8,
      opacity: 0,
      isKeyword: i < keywords.length,
      isPopped: false,
      popTime: 0,
      keywordOrder: i < keywords.length ? i : -1,
      upgradedTexture: false,
    }))
  }, [keywords, words])

  useEffect(() => {
    stateTimeRef.current = 0
    if (appState === 'dissolution') setTimeout(() => setAppState('scanning'), 6000)
    if (appState === 'scanning')    setTimeout(() => setAppState('fog'), 5000)
    if (appState === 'fog') {
      dissolutionData.current.forEach((b) => {
        if (!b.isKeyword) {
          setTimeout(() => { b.isPopped = true }, Math.random() * 4000)
        }
      })
      setTimeout(() => setAppState('crystallization'), 5000)
    }
    if (appState === 'crystallization') setTimeout(() => setAppState('settled'), 3000)
  }, [appState])

  useFrame((_, delta) => {
    timeRef.current += delta
    stateTimeRef.current += delta
    const t = timeRef.current

    // IDLE balloons
    idleData.current.forEach((b, i) => {
      const sprite = idleRefs.current[i]
      if (!sprite) return
      if (appState === 'idle') {
        b.y += b.speed
        b.x += Math.sin(t * 0.5 + b.wobble) * 0.003
        if (b.y > 6) {
          b.y = -5
          b.x = (Math.random() - 0.5) * 8
          b.colorIdx = Math.floor(Math.random() * BALLOON_COLORS.length)
          if (idleTextures[b.colorIdx]) {
            ;(sprite.material as THREE.SpriteMaterial).map = idleTextures[b.colorIdx]
            ;(sprite.material as THREE.SpriteMaterial).needsUpdate = true
          }
        }
        sprite.position.set(b.x, b.y, b.z)
        sprite.scale.set(b.scale, b.scale * 1.2, 1)
        ;(sprite.material as THREE.SpriteMaterial).opacity = 0.82
      } else {
        ;(sprite.material as THREE.SpriteMaterial).opacity = Math.max(
          0,
          (sprite.material as THREE.SpriteMaterial).opacity - delta * 2
        )
      }
    })

    // DISSOLUTION balloons
    dissolutionData.current.forEach((b, i) => {
      const sprite = dissolutionRefs.current[i]
      if (!sprite) return

      if (appState === 'idle') {
        ;(sprite.material as THREE.SpriteMaterial).opacity = 0
        return
      }

      if (b.isPopped) {
        const s = sprite.scale.x
        sprite.scale.set(s * 1.08, s * 1.08, 1)
        ;(sprite.material as THREE.SpriteMaterial).opacity = Math.max(
          0,
          (sprite.material as THREE.SpriteMaterial).opacity - delta * 4
        )
        return
      }

      b.opacity = Math.min(0.88, b.opacity + delta * 1.5)

      if (appState === 'dissolution' || appState === 'scanning') {
        b.x += b.vx * 2
        b.y += b.vy * 0.8
        b.x += Math.sin(t * 0.8 + b.wobble) * 0.008
        if (Math.abs(b.x) > 7) b.vx *= -1
        if (b.y > 5) b.vy *= -1
        if (b.y < -5) b.vy = Math.abs(b.vy)
      }

      if (appState === 'scanning' && b.isKeyword && !b.upgradedTexture) {
        const color = BALLOON_COLORS[b.colorIdx]
        const label = keywords[b.keywordOrder]
        const largeTexture = createBalloonTexture(color, label, true)
        ;(sprite.material as THREE.SpriteMaterial).map = largeTexture
        ;(sprite.material as THREE.SpriteMaterial).needsUpdate = true
        b.upgradedTexture = true
      }

      if (appState === 'settled' && b.isKeyword) {
        const total = keywords.length
        const spacing = total > 1 ? Math.min(1.8, 12.0 / total) : 0
        const targetX = (b.keywordOrder - (total - 1) / 2) * spacing
        const targetY = 2.0 + Math.sin(t * 0.8 + b.keywordOrder) * 0.08
        b.x += (targetX - b.x) * delta * 2
        b.y += (targetY - b.y) * delta * 2
        sprite.position.set(b.x, b.y, b.z)
        sprite.scale.set(1.4, 1.4 * 1.2, 1)
        ;(sprite.material as THREE.SpriteMaterial).opacity = 0.95
        return
      }

      if (appState === 'crystallization' && b.isKeyword) {
        b.x += (0 - b.x) * delta * 1.5
        b.y += (0 - b.y) * delta * 1.5
      }

      sprite.position.set(b.x, b.y, b.z)
      sprite.scale.set(b.scale, b.scale * 1.2, 1)
      ;(sprite.material as THREE.SpriteMaterial).opacity = b.opacity
    })
  })

  return (
    <group>
      {idleTextures.length > 0 && idleData.current.map((b, i) => (
        <sprite
          key={`idle-${i}`}
          ref={el => { if (el) idleRefs.current[i] = el }}
          position={[b.x, b.y, b.z]}
          scale={[b.scale, b.scale * 1.2, 1]}
        >
          <spriteMaterial
            map={idleTextures[b.colorIdx]}
            transparent
            opacity={0.82}
            depthWrite={false}
          />
        </sprite>
      ))}

      {dissolutionTextures.length > 0 && dissolutionData.current.map((b, i) => (
        <sprite
          key={`dissolution-${i}`}
          ref={el => { if (el) dissolutionRefs.current[i] = el }}
          position={[b.x, b.y, b.z]}
          scale={[b.scale, b.scale * 1.2, 1]}
        >
          <spriteMaterial
            map={dissolutionTextures[i]}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  )
}