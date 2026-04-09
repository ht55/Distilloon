'use client'

import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { useState, useRef, useEffect } from 'react'
import LibraryScene from './LibraryScene'
import { alfaSlab } from '@/app/fonts'

export type AppState = 'idle' | 'dissolution' | 'scanning' | 'fog' | 'crystallization' | 'settled'

const phases = ['dissolution','scanning','fog','crystallization','settled']

export default function Library() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [url, setUrl] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [geminiKey, setGeminiKey] = useState('')
  const [modalReason, setModalReason] = useState<'settings' | 'required'>('settings')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [keywords, setKeywords] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [words, setWords] = useState<string[]>([])

  useEffect(() => {
    setGeminiKey(localStorage.getItem('google_api_key') || '')
  }, [])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.4
    }
  }, [])

  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.style.opacity = appState === 'idle' ? '1' : '0'
  }, [appState])

  const handleSubmit = async () => {
    if (!url.trim()) return
    const key = localStorage.getItem('google_api_key')
    if (!key) {
      setModalReason('required')
      setShowModal(true)
      return
    }
    setAppState('dissolution')

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          apiKey: key,
        })
      })
      const data = await res.json()
      console.log('RAW data:', data) //デバッグ
      if (data.error) {
        console.error(data.error)
        return
      }
      console.log('API response:', data) //デバッグ
      console.log('keywords:', data.keywords) //デバッグ
      setKeywords(data.keywords)
      setWords(data.words || [])
      setSummary(data.summary)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#faf8f5' }}>

    {/* Background PNG */}
    <img
      src="/triangle.png"
      style={{
        position: 'relative',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center', 
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden'
      }}
    />

      {/* carousel video */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          top: '46.5%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '420px',
          height: '420px',
          objectFit: 'cover',
          opacity: 1,
          transition: 'opacity 1s ease',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
          <source src="/carousel.webm" type="video/webm" />
          <source src="/carousel.mov" type="video/quicktime" /> 
      </video>  

      {/* Three.js canvas */}
      <Canvas style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={60} />
        <ambientLight intensity={0.8} />
        <LibraryScene 
          appState={appState}
          setAppState={setAppState}
          keywords={keywords}
          summary={summary}
          words={words}
        />
      </Canvas>

      {/* Title */}
      {appState === 'idle' && (
        <div style={{
          position: 'absolute',
          top: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          <svg width="500" height="180" viewBox="0 0 500 120">
            <defs>
              <path
                id="arch"
                d="M 50,110 A 240,240 0 0,1 450,110"
              />
            </defs>
            <text
              style={{ fontFamily: 'var(--font-alfa-slab)', fontSize: '42px', fontWeight: '900' }}
              fill="#111"
              letterSpacing="4"
            >
              <textPath href="#arch" startOffset="50%" textAnchor="middle">
                Distilloon
              </textPath>
            </text>
          </svg>
        </div>
      )}

      {/* URL input */}
      {appState === 'idle' && (
        <div style={{
          position: 'absolute',
          bottom: '85px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          zIndex: 10,
        }}>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Enter YouTube URL"
            style={{
              background: 'rgba(0,0,0,0.2)',
              border: '3px solid #000',
              color: '#000',
              padding: '12px 20px',
              borderRadius: '99px',
              fontSize: '14px',
              fontFamily: 'var(--font-alfa-slab)',
              height: '35px',
              width: '300px',
              outline: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              background: 'rgba(0,0,0,0.55)',
              border: '2px #707070',
              color: '#FCF4E3',
              padding: '0px 0px',
              borderRadius: '99px',
              fontSize: '13px',
              fontFamily: 'var(--font-alfa-slab)',
              height: '30px',
              width: '65px',
              cursor: 'pointer',
            }}
          >
            Search
          </button>

          {/* Settings icon */}
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: 'rgba(0,0,0,0.2)',
              border: '0px solid rgba(0,0,0,0.99)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.2)')}
          >
            🔑 
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(6px)',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{
            background: 'rgba(255, 246, 235, 0.77)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '3px solid rgba(0,0,0,0.85)',
            borderRadius: '20px',
            padding: '36px 40px',
            width: '360px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}>
            <div style={{
              fontFamily: 'var(--font-alfa-slab)',
              fontSize: '20px',
              color: '#2a1a0a',
              marginBottom: '8px',
              textAlign: 'center',
              letterSpacing: '0.02em',
            }}>
              API Key
            </div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(0,0,0,0.99)',
              textAlign: 'center',
              marginBottom: '28px',
              letterSpacing: '0.03em',
              lineHeight: '1.6',
            }}>
              A Google API Key is required to search.
              <br/>
              Works with both Gemini and YouTube Data API.
              <br/>
              Stored locally, never sent to any server.
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-alfa-slab)',
                fontSize: '13px',
                color: '#2a1a0a',
                marginBottom: '8px',
                letterSpacing: '0.05em',
              }}>
                Google API Key
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                placeholder="AIza..."
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.08)',
                  border: '1.5px solid rgba(0,0,0,0.6)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  color: '#000',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1.5px solid rgba(0,0,0,0.25)',
                  borderRadius: '99px',
                  padding: '10px',
                  fontFamily: 'var(--font-alfa-slab)',
                  fontSize: '13px',
                  color: '#2a1a0a',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('google_api_key', geminiKey)
                  setShowModal(false)
                }}
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.7)',
                  border: 'none',
                  borderRadius: '99px',
                  padding: '10px',
                  fontFamily: 'var(--font-alfa-slab)',
                  fontSize: '12px',
                  color: '#FCF4E3',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
            <div style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: 'rgba(0,0,0,0.75)',
              textAlign: 'center',
              marginTop: '16px',
              lineHeight: '1.6',
              }}>
              * Prototype uses public caption data. Production implementation uses OAuth 2.0.
            </div>
          </div>
        </div>
      )}  

      {/* Phase indicator */}
      {appState !== 'idle' && (
        <div style={{
          position: 'absolute',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          background: 'rgba(0,0,0,0.8)',
          border: '0px solid rgba(0,0,0,0.1)',
          borderRadius: '99px',
          padding: '10px 28px',
          fontFamily: 'var(--font-alfa-slab)',
          fontSize: '12px',
          gap: '8px',
          alignItems: 'center',
          zIndex: 10,
        }}>
          {phases.map((phase, i) => (
            <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                color: 'rgba(255,255,255,0.9)',
                background: phases.indexOf(appState) >= i ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
                transition: 'background 0.3s',
              }}/>
              {i < phases.length - 1 && (
                <div style={{ width: '24px', height: '1px', background: 'rgba(255,255,255,0.7)' }}/>
              )}
            </div>
          ))}
          <div style={{
            marginLeft: '12px',
            fontSize: '11px',
            fontFamily: 'var(--font-alfa)',
            color: 'rgba(255,255,255)',
            letterSpacing: '0.1em',
          }}>
            {appState.toUpperCase()}
          </div>
        </div>
      )}

      {/* Summary display */}
      {appState === 'settled' && summary && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '560px',
          textAlign: 'center',
          zIndex: 10,
        }}>
          <div style={{
            fontFamily: 'var(--font-alfa-slab)',
            fontSize: '19px',
            color: '#2a1a0a',
            marginBottom: '3px',
            letterSpacing: '0.05em',
          }}>
            Summary
          </div>
          <div style={{
            fontSize: '13px',
            color: 'rgba(0,0,0,0.7)',
            lineHeight: '1.9',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: '16px',
            padding: '10px 28px',
            fontFamily: 'var(--font-alfa-slab)',
          }}>
            {summary}
          </div>

          {/* Reset button */}
          {appState === 'settled' && (
            <button
              onClick={() => {
                setAppState('idle')
                setUrl('')
                setKeywords([])
                setSummary('')
                setWords([])
              }}
              style={{
                position: 'absolute',
                bottom: '-50px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.2)',
                border: '0px solid rgba(0,0,0,0.1)',
                borderRadius: '99px',
                padding: '10px 28px',
                fontFamily: 'var(--font-alfa-slab)',
                fontSize: '12px',
                color: 'rgba(0,0,0,0.5)',
                cursor: 'pointer',
                zIndex: 10,
                letterSpacing: '0.05em',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(0,0,0,0.9)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(0,0,0,0.5)'}
            >
              ← Try another video
            </button>
          )}
        </div>
      )}
    </div>
  )
}