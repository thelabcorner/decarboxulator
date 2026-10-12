import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import './CompactSelect.css';

export type CompactOption<T extends string> = { value: T; label: string; description?: string };
type Props<T extends string> = {
  id?: string;
  label?: string;
  ariaLabel?: string;
  value: T;
  options: readonly CompactOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
};
type MenuPosition = { top: number; left: number; width: number; maxHeight: number };

/**
 * Task-inspired dense select menu, adapted for the studio's nested ScrollViews.
 * Portaling prevents clipping by the worksheet viewport, sidebar and library.
 * No global listeners while closed; one menu is mounted per opened control.
 */
export function CompactSelect<T extends string>({
  id, label, ariaLabel, value, options, onChange, disabled = false, className = '', title,
}: Props<T>) {
  const generated = useId();
  const triggerId = id ?? generated;
  const menuId = generated + '-choices';
  const name = ariaLabel ?? label ?? 'Choose value';
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const typeAhead = useRef('');
  const typeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const selected = options.find(option => option.value === value);
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));

  function close(restoreFocus = false) {
    setOpen(false);
    setPosition(null);
    typeAhead.current = '';
    if (typeTimer.current !== null) window.clearTimeout(typeTimer.current);
    typeTimer.current = null;
    if (restoreFocus) trigger.current?.focus({preventScroll: true});
  }
  function focusAt(index: number) {
    const buttons = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
    buttons?.[Math.max(0, Math.min(buttons.length - 1, index))]?.focus({preventScroll: true});
  }
  function measure() {
    const button = trigger.current, popup = menu.current;
    if (!button || !popup) return;
    const rect = button.getBoundingClientRect();
    const vv = window.visualViewport;
    const viewportLeft = vv?.offsetLeft ?? 0;
    const viewportTop = vv?.offsetTop ?? 0;
    const viewportWidth = vv?.width ?? window.innerWidth;
    const viewportHeight = vv?.height ?? window.innerHeight;
    const right = viewportLeft + viewportWidth - 8;
    const bottom = viewportTop + viewportHeight - 8;
    const width = Math.min(Math.max(196, rect.width), Math.max(80, viewportWidth - 16));
    const maxHeight = Math.max(60, Math.min(370, viewportHeight - 16));
    const naturalHeight = Math.min(popup.scrollHeight, maxHeight);
    const below = bottom - rect.bottom - 4;
    const above = rect.top - viewportTop - 12;
    const placeAbove = below < Math.min(naturalHeight, 150) && above > below;
    const top = placeAbove
      ? Math.max(viewportTop + 8, rect.top - naturalHeight - 4)
      : Math.max(viewportTop + 8, Math.min(rect.bottom + 4, bottom - naturalHeight));
    setPosition({
      top, left: Math.max(viewportLeft + 8, Math.min(rect.left, right - width)),
      width, maxHeight: Math.min(maxHeight, placeAbove ? Math.max(60, above) : Math.max(60, bottom - top)),
    });
  }

  useLayoutEffect(() => {
    if (open) measure();
    // Position after the portal attaches; don't focus visibility:hidden rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useLayoutEffect(() => {
    if (open && position) focusAt(selectedIndex);
    // Avoid moving focus on every position update (e.g. visual viewport resize).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, Boolean(position)]);

  useEffect(() => {
    if (!open) return;
    const openedAt = performance.now();
    const inside = (node: EventTarget | null) => node instanceof Node &&
      Boolean(trigger.current?.contains(node) || menu.current?.contains(node));
    const outside = (event: PointerEvent) => { if (!inside(event.target)) close(); };
    const focusOut = (event: FocusEvent) => { if (!inside(event.target)) close(); };
    const scroll = (event: Event) => {
      // Task's late scrollIntoView regression: a queued scroll immediately
      // after opening must not dismiss the new menu.
      if (performance.now() - openedAt < 100 || inside(event.target)) return;
      close();
    };
    const reposition = () => measure();
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', focusOut);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', focusOut);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('scroll', reposition);
      if (typeTimer.current !== null) window.clearTimeout(typeTimer.current);
    };
    // Listener lifecycle is intentionally tied only to open/closed state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function choose(option: CompactOption<T>) {
    close(true);
    if (option.value !== value) onChange(option.value);
  }
  function moveTab(reverse: boolean) {
    // A body portal is not adjacent to its trigger in DOM tab order.
    // Continue from the trigger's real position, including inside the library dialog.
    const controls = Array.from(document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(node => node.getClientRects().length > 0 && !node.closest('.studio-compact-menu'));
    const at = controls.indexOf(trigger.current!);
    const next = controls[at + (reverse ? -1 : 1)];
    close();
    (next ?? trigger.current)?.focus({preventScroll:true});
  }
  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    const activeIndex = items.findIndex(node => node === document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); close(true); return;
    }
    if (event.key === 'Tab') {
      event.preventDefault(); event.stopPropagation(); moveTab(event.shiftKey); return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowDown' ? (activeIndex + 1) % items.length
          : (activeIndex - 1 + items.length) % items.length;
      focusAt(next);
      return;
    }
    // Enter/Space activate the focused native button; don't dispatch twice.
    if (event.key.length === 1 && event.key !== ' ' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      typeAhead.current += event.key.toLocaleLowerCase();
      if (typeTimer.current !== null) window.clearTimeout(typeTimer.current);
      typeTimer.current = window.setTimeout(() => {typeAhead.current = '';}, 540);
      const find = (needle: string) => options.findIndex((_, offset) => {
        const i = (activeIndex + offset + 1) % options.length;
        return options[i]?.label.toLocaleLowerCase().startsWith(needle);
      });
      const match = find(typeAhead.current);
      if (match >= 0) {
        event.preventDefault();
        focusAt((activeIndex + match + 1) % options.length);
      }
    }
  }

  return <div className={`studio-compact-select ${className}`}>
    {label && <label className="studio-field-caption" htmlFor={triggerId}>{label}</label>}
    <button id={triggerId} ref={trigger} type="button"
      className="studio-compact-trigger" title={title ?? name} aria-label={name}
      aria-haspopup="menu" aria-controls={open ? menuId : undefined}
      aria-expanded={open} data-open={open} disabled={disabled || !options.length}
      onClick={() => { if (open) close(true); else { setPosition(null); setOpen(true); } }}
      onKeyDown={event => {
        if (!open && ['ArrowDown', 'ArrowUp', ' '].includes(event.key)) {
          event.preventDefault(); setPosition(null); setOpen(true);
        }
      }}>
      <span className="studio-compact-value">{selected?.label ?? 'Choose…'}</span>
      <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true"/>
    </button>
    {open && typeof document !== 'undefined' && createPortal(
      <div id={menuId} ref={menu} className="studio-compact-menu" role="menu" aria-label={name}
        data-positioned={Boolean(position)}
        style={{top:position?.top??0, left:position?.left??0,
          width:position?.width??Math.max(196, trigger.current?.offsetWidth??196),
          maxHeight:position?.maxHeight??370}}
        onKeyDown={onMenuKey}
        onContextMenu={event=>event.preventDefault()}>
        {options.map(option => <button type="button" key={option.value} role="menuitemradio"
          aria-checked={value === option.value} className="studio-compact-item"
          onClick={()=>choose(option)}>
          <span className="studio-compact-check" aria-hidden="true">
            {value===option.value && <Check size={13} strokeWidth={2}/>}
          </span>
          <span className="studio-compact-choice">{option.label}
            {option.description && <small>{option.description}</small>}
          </span>
        </button>)}
      </div>, document.body)}
  </div>;
}
