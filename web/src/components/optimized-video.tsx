import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface OptimizedVideoProps {
  src: string
  poster?: string
  className?: string
  containerClassName?: string
}

export function OptimizedVideo({ src, poster, className, containerClassName }: OptimizedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Intersection Observer for lazy loading
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '200px',
        threshold: 0,
      },
    )

    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  // Load and play video when in view
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isInView) return

    const handleLoaded = () => {
      setIsLoaded(true)
      video.play().catch(() => {
        // Autoplay blocked, still show the video
        setIsLoaded(true)
      })
    }

    // Listen for multiple events to catch when video is ready
    video.addEventListener('canplaythrough', handleLoaded)
    video.addEventListener('loadeddata', handleLoaded)

    // Set src and start loading
    video.src = src
    video.load()

    return () => {
      video.removeEventListener('canplaythrough', handleLoaded)
      video.removeEventListener('loadeddata', handleLoaded)
    }
  }, [isInView, src])

  return (
    <div ref={containerRef} className={cn('relative bg-muted', containerClassName)}>
      {/* Loading state */}
      {!isLoaded && (
        <div className='absolute inset-0 flex items-center justify-center bg-muted'>
          <div className='flex flex-col items-center gap-3 text-muted-foreground'>
            <svg className='h-6 w-6 animate-spin' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
              <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
              <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
            </svg>
            <span className='text-sm'>Loading video...</span>
          </div>
        </div>
      )}

      {/* Video element - src set dynamically when in view */}
      <video ref={videoRef} className={cn('w-full transition-opacity duration-300', isLoaded ? 'opacity-100' : 'opacity-0', className)} loop muted playsInline poster={poster} />
    </div>
  )
}
