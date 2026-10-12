import { useCallback, useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import './ScrollView.css';

type Axis = 'vertical' | 'horizontal';
type Metrics = { visible: boolean; size: number; offset: number };

// Navigation swaps the contents of the persistent workspace viewport. Without
// keyed restoration, every calculator inherits the scroll position of the last.
// This is intentionally session-only: persisted offsets become stale after edits.
const rememberedScrollOffsets = new Map<string, number>();
const MAX_REMEMBERED_SCROLLS = 40;

function rememberScroll(key: string, offset: number) {
  if (rememberedScrollOffsets.has(key)) rememberedScrollOffsets.delete(key);
  rememberedScrollOffsets.set(key, offset);
  if (rememberedScrollOffsets.size > MAX_REMEMBERED_SCROLLS) {
    rememberedScrollOffsets.delete(rememberedScrollOffsets.keys().next().value!);
  }
}

export interface ScrollViewProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'main' | 'nav' | 'section';
  children: ReactNode;
  orientation?: Axis;
  viewportLabel: string;
  viewportRef?: (element: HTMLDivElement | null) => void;
  viewportClassName?: string;
  thumbVisibility?: 'hover' | 'scroll';
  /** Restore independent scroll offsets when a persistent viewport changes route. */
  restoreKey?: string;
}

/**
 * React adaptation of OpenFork's ScrollView behavior:
 * native composited scroll / momentum, with an unobtrusive draggable overlay thumb.
 * Never virtualize ordinary studio content: only hide the browser-owned scrollbar.
 */
export function ScrollView({
  as: Tag = 'div', children, orientation = 'vertical', viewportLabel,
  viewportRef: externalViewportRef, viewportClassName = '',
  thumbVisibility = 'hover', restoreKey, className = '', ...rest
}: ScrollViewProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const drag = useRef<{ pointer: number; grab: number } | null>(null);
  const currentRestoreKey = useRef(restoreKey);
  const restoringScroll = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({ visible: false, size: 0, offset: 0 });
  const horizontal = orientation === 'horizontal';

  const update = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const client = horizontal ? el.clientWidth : el.clientHeight;
    const total = horizontal ? el.scrollWidth : el.scrollHeight;
    const position = horizontal ? el.scrollLeft : el.scrollTop;
    const track = Math.max(0, client - 16);
    const visible = total > client + 1 && track > 0;
    const size = visible ? Math.min(track, Math.max(32, (client / total) * track)) : 0;
    const offset = visible ? 8 + Math.max(0, Math.min(track - size, (position / (total - client)) * (track - size))) : 0;
    setMetrics(previous =>
      previous.visible === visible && Math.abs(previous.size - size) < .5 && Math.abs(previous.offset - offset) < .5
        ? previous : { visible, size, offset },
    );
  }, [horizontal]);

  const schedule = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => { frame.current = null; update(); });
  }, [update]);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el || !restoreKey) return;
    // Native scroll anchoring and router focus restoration can both run after
    // React commits new route content. Stabilize the requested offset across
    // the first two frames, without mistaking that adjustment for user input.
    currentRestoreKey.current = restoreKey;
    const offset = rememberedScrollOffsets.get(restoreKey) ?? 0;
    restoringScroll.current = true;
    const restore = () => {
      if (horizontal) el.scrollLeft = offset;
      else el.scrollTop = offset;
    };
    restore();
    let nextFrame = 0;
    const frame = requestAnimationFrame(() => {
      restore();
      nextFrame = requestAnimationFrame(() => {
        restore();
        restoringScroll.current = false;
        schedule();
      });
    });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(nextFrame);
      restoringScroll.current = false;
    };
  }, [horizontal, restoreKey, schedule]);

  const markScrolling = () => {
    setScrolling(true);
    if (idle.current !== null) clearTimeout(idle.current);
    idle.current = setTimeout(() => { idle.current = null; setScrolling(false); }, 800);
  };

  useEffect(() => {
    const node = viewport.current;
    externalViewportRef?.(node);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (node) observer?.observe(node);
    if (content.current) observer?.observe(content.current);
    window.addEventListener('resize', schedule, { passive: true });
    schedule();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      externalViewportRef?.(null);
      // React StrictMode replays effect setup/cleanup in development. A cancelled
      // frame must release its handle, or every subsequent scroll event sees a
      // pending frame forever and the overlay thumb freezes in place.
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      if (idle.current !== null) {
        clearTimeout(idle.current);
        idle.current = null;
      }
    };
  }, [schedule, externalViewportRef]);

  useEffect(() => { schedule(); }, [children, schedule]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!metrics.visible || !thumb.current) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current = {
      pointer: event.pointerId,
      grab: (horizontal ? event.clientX - thumb.current.getBoundingClientRect().left
        : event.clientY - thumb.current.getBoundingClientRect().top),
    };
    thumb.current.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointer !== event.pointerId || !viewport.current) return;
    const el = viewport.current;
    const bounds = el.getBoundingClientRect();
    const client = horizontal ? el.clientWidth : el.clientHeight;
    const total = horizontal ? el.scrollWidth : el.scrollHeight;
    const extent = Math.max(1, client - 16 - metrics.size);
    const origin = horizontal ? bounds.left : bounds.top;
    const pointer = horizontal ? event.clientX : event.clientY;
    const normalized = Math.max(0, Math.min(1, (pointer - origin - 8 - drag.current.grab) / extent));
    if (horizontal) el.scrollLeft = normalized * (total - client);
    else el.scrollTop = normalized * (total - client);
    markScrolling();
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointer !== event.pointerId) return;
    if (thumb.current?.hasPointerCapture(event.pointerId)) thumb.current.releasePointerCapture(event.pointerId);
    drag.current = null;
    setDragging(false);
  }

  return (
    <Tag className={`scroll-view ${className}`} data-orientation={orientation}
      onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} {...rest}>
      <div ref={viewport} className={`scroll-view__viewport ${viewportClassName}`}
        data-scrollable data-orientation={orientation} tabIndex={0}
        role="region" aria-label={viewportLabel}
         onScroll={() => {
           const key = currentRestoreKey.current;
           if (key && !restoringScroll.current) rememberScroll(key, horizontal ? viewport.current!.scrollLeft : viewport.current!.scrollTop);
           schedule();
           markScrolling();
         }}>
        <div className="scroll-view__content" ref={content}>{children}</div>
      </div>
      {metrics.visible && (
        <div ref={thumb} className="scroll-view__thumb" data-orientation={orientation}
          data-visible={dragging || scrolling || (thumbVisibility === 'hover' && hovered)}
          data-dragging={dragging} aria-hidden="true"
          style={horizontal
            ? { width: metrics.size, transform: `translateX(${metrics.offset}px)` }
            : { height: metrics.size, transform: `translateY(${metrics.offset}px)` }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}/>
      )}
    </Tag>
  );
}
