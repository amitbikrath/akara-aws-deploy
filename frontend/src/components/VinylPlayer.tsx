'use client'

import { useEffect, useState } from 'react'

interface Track {
  id: string
  title: string
  artists: string[]
  cover: {
    thumbnail: string
  }
  duration: number
}

interface VinylPlayerProps {
  track: Track
  isPlaying: boolean
  onPlayPause: () => void
}

export default function VinylPlayer({ track, isPlaying, onPlayPause }: VinylPlayerProps) {
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  // Simulate progress for demo (in real app, this would sync with actual audio)
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 1
          if (newTime >= track.duration) {
            return 0 // Loop for demo
          }
          return newTime
        })
        setProgress(prev => {
          const newProgress = prev + (100 / track.duration)
          if (newProgress >= 100) {
            return 0 // Loop for demo
          }
          return newProgress
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isPlaying, track.duration])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="card-glass max-w-md mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-1">{track.title}</h3>
        <p className="text-white/70">{track.artists.join(', ')}</p>
      </div>

      {/* Vinyl Record */}
      <div className="relative flex items-center justify-center mb-6">
        <div 
          className={`relative w-48 h-48 rounded-full bg-gradient-to-br from-gray-900 to-black border-4 border-gray-700 ${
            isPlaying ? 'animate-spin-slow' : ''
          }`}
          style={{
            backgroundImage: `conic-gradient(from 0deg, #1a1a1a 0deg, #2a2a2a 45deg, #1a1a1a 90deg, #2a2a2a 135deg, #1a1a1a 180deg, #2a2a2a 225deg, #1a1a1a 270deg, #2a2a2a 315deg, #1a1a1a 360deg)`
          }}
        >
          {/* Vinyl grooves */}
          <div className="absolute inset-4 rounded-full border border-gray-600/30"></div>
          <div className="absolute inset-8 rounded-full border border-gray-600/20"></div>
          <div className="absolute inset-12 rounded-full border border-gray-600/10"></div>
          
          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <img
                src={track.cover.thumbnail}
                alt={track.title}
                className="w-12 h-12 rounded-full object-cover"
              />
            </div>
          </div>

          {/* Progress dot */}
          {isPlaying && (
            <div
              className="absolute w-2 h-2 bg-primary-400 rounded-full"
              style={{
                top: '10px',
                left: '50%',
                transformOrigin: '50% 86px',
                transform: `translateX(-50%) rotate(${progress * 3.6}deg)`,
                transition: 'none'
              }}
            />
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-white/10 rounded-full h-1">
            <div 
              className="bg-primary-500 h-1 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-white/60">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(track.duration)}</span>
          </div>
        </div>

        {/* Play/Pause Button */}
        <div className="flex justify-center">
          <button
            onClick={onPlayPause}
            className="w-14 h-14 bg-primary-500 hover:bg-primary-600 rounded-full flex items-center justify-center transition-colors group"
          >
            {isPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
