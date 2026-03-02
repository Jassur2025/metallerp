import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '../utils/logger';

/**
 * Hook for lazy Firestore subscriptions.
 * 
 * Only subscribes when the component is actually mounted (tab is active).
 * Automatically unsubscribes when the component unmounts.
 * 
 * Also supports visibility-based optimization: pauses subscription when the browser tab
 * is hidden (via Page Visibility API) and resumes when visible again.
 * 
 * @param subscribe - Function that creates the subscription, returns an unsubscribe function
 * @param enabled - Whether the subscription should be active (e.g., `activeTab === 'sales'`)
 * @param options - Configuration options
 * 
 * @example
 * ```ts
 * // In a Sales component:
 * const { data: orders, loading } = useLazySubscription(
 *   (cb) => orderService.subscribe(cb),
 *   activeTab === 'sales', // Only subscribe when on Sales tab
 * );
 * ```
 */
export interface LazySubscriptionOptions {
  /** Unsubscribe when browser tab is hidden (default: true) */
  pauseOnHidden?: boolean;
  /** Debounce resuming subscription in ms (default: 500) */
  resumeDelay?: number;
  /** Component/hook name for logging */
  debugName?: string;
}

export function useLazySubscription<T>(
  subscribeFn: (callback: (data: T) => void) => () => void,
  enabled: boolean = true,
  options: LazySubscriptionOptions = {}
): { data: T | null; loading: boolean; error: string | null } {
  const { pauseOnHidden = true, resumeDelay = 500, debugName = 'useLazySubscription' } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSubscribe = useCallback(() => {
    if (unsubRef.current) return; // Already subscribed
    
    try {
      logger.debug(debugName, 'Subscribing...');
      unsubRef.current = subscribeFn((newData) => {
        setData(newData);
        setLoading(false);
        setError(null);
      });
    } catch (err: any) {
      logger.error(debugName, 'Subscription error:', err);
      setError(err.message || 'Subscription failed');
      setLoading(false);
    }
  }, [subscribeFn, debugName]);

  const doUnsubscribe = useCallback(() => {
    if (unsubRef.current) {
      logger.debug(debugName, 'Unsubscribing...');
      unsubRef.current();
      unsubRef.current = null;
    }
  }, [debugName]);

  // Main lifecycle: subscribe/unsubscribe based on `enabled`
  useEffect(() => {
    if (enabled) {
      doSubscribe();
    } else {
      doUnsubscribe();
      setData(null);
      setLoading(true);
    }

    return () => {
      doUnsubscribe();
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
      }
    };
  }, [enabled, doSubscribe, doUnsubscribe]);

  // Page Visibility optimization
  useEffect(() => {
    if (!pauseOnHidden || !enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became hidden — unsubscribe to save bandwidth
        if (resumeTimerRef.current) {
          clearTimeout(resumeTimerRef.current);
          resumeTimerRef.current = null;
        }
        doUnsubscribe();
      } else {
        // Tab became visible — resubscribe after a short delay
        resumeTimerRef.current = setTimeout(() => {
          doSubscribe();
        }, resumeDelay);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
      }
    };
  }, [pauseOnHidden, enabled, doSubscribe, doUnsubscribe, resumeDelay]);

  return { data, loading, error };
}
