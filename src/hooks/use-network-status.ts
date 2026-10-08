import { useState, useEffect, useCallback } from 'react'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const getNetworkType = useCallback((): 'wifi' | 'cellular' | 'ethernet' | 'unknown' => {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
      return 'unknown'
    }
    const connection = (navigator as Navigator & { connection?: { type?: string } }).connection
    const type = connection?.type
    return type === 'wifi' || type === 'cellular' || type === 'ethernet' ? type : 'unknown'
  }, [])

  return {
    isOnline,
    networkType: getNetworkType(),
  }
}
