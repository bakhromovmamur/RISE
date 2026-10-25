import { useText } from "./LifeUI";
import {
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleCheck,
  Flame,
  Footprints,
  Leaf,
  MessageCircle,
  Sprout,
  Sun,
  Target,
  X,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { DAY_NAMES, WEEKDAYS, type IconName } from "./model";
export function TabHeading({ title, children }: { title: string; children?: ReactNode }) {
  return <header className="tab-heading"><h1 tabIndex={-1}>{title}</h1>{children}</header>;
}
export const icons: Record<IconName, LucideIcon> = {
  book: BookOpen,
  walk: Footprints,
  learn: MessageCircle,
  reflect: PenLine,
  focus: Target,
  leaf: Leaf,
};
export function HabitIcon({
  name,
  small = false,
}: {
  name: IconName;
  small?: boolean;
}) {
  const Icon = icons[name] || Leaf;
  return (
    <span className={`habit-icon ${name} ${small ? "small" : ""}`}>
      <Icon size={small ? 19 : 24} strokeWidth={1.7} />
    </span>
  );
}
export function Pip({
  mood = "welcome",
  size = 150,
  className = "",
}: {
  mood?: "welcome" | "focus" | "celebrate" | "rest" | "return" | "scarf";
  size?: number;
  className?: string;
}) {
  const t = useText();
  const i = [
    "welcome",
    "focus",
    "celebrate",
    "rest",
    "return",
    "scarf",
  ].indexOf(mood);
  return (
    <div
      className={`pip ${className}`}
      role="img"
      aria-label={t("Pip, your {0} seed companion", undefined, [mood === "scarf" ? t("linen scarf-wearing") : mood === "return" ? t("encouraging") : mood === "focus" ? t("focused") : mood === "rest" ? t("resting") : mood === "celebrate" ? t("celebrating") : t("welcoming")])}
      style={{
        width: size,
        height: size,
        backgroundPosition: `${(i % 3) * 50}% ${Math.floor(i / 3) * 100}%`,
      }}
    />
  );
}
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function IconButton({
  children,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className="icon-button" aria-label={label} {...props}>
      {children}
    </button>
  );
}
export function SectionTitle({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        style={{
          transform: `scaleX(${Math.max(0, Math.min(value, 100)) / 100})`,
        }}
      />
    </div>
  );
}
export function Streak({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  const t = useText();
  return (
    <button
      className="streak"
      onClick={onClick}
      aria-label={t("{0} planned days in a row. How streaks work", undefined, [count])}
    >
      <Flame size={18} fill="currentColor" strokeWidth={1.4} />
      <strong>{count}</strong>
      <span>
        {t("planned ")}<br />
        {t("days ")}</span>
    </button>
  );
}
export function WeekdaySelector({
  days,
  onChange,
}: {
  days: number[];
  onChange: (days: number[]) => void;
}) {
  const t = useText();
  return (
    <div className="weekday-selector" aria-label={t("Planned days")}>
      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
        <button
          type="button"
          key={d}
          aria-label={t.weekday(d, false)}
          aria-pressed={days.includes(d)}
          className={days.includes(d) ? "selected" : ""}
          onClick={() =>
            onChange(
              days.includes(d) ? days.filter((n) => n !== d) : [...days, d],
            )
          }
        >
          {t.weekday(d, true)}
        </button>
      ))}
    </div>
  );
}
export function GroupRow({
  icon,
  title,
  detail,
  onClick,
  end,
}: {
  icon?: ReactNode;
  title: string;
  detail?: string;
  onClick?: () => void;
  end?: ReactNode;
}) {
  const content = (
    <>
      {icon && <span className="row-icon">{icon}</span>}
      <span className="row-copy">
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      {end ?? (onClick && <ChevronRight size={18} />)}
    </>
  );
  return onClick ? (
    <button className="group-row" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="group-row">{content}</div>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`toggle ${checked ? "on" : ""}`}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
    >
      <span />
    </button>
  );
}
export function EmptyState({
  title,
  text,
  children,
  mood = "rest",
}: {
  title: string;
  text: string;
  children?: ReactNode;
  mood?: "rest" | "welcome" | "return";
}) {
  return (
    <div className="empty-state">
      <Pip mood={mood} size={180} />
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Badge({ xp, size = 60 }: { xp: number; size?: number }) {
  const Icon =
    xp === 100
      ? Footprints
      : xp === 250
        ? Sprout
        : xp === 500
          ? Leaf
          : xp === 800
            ? Sun
            : Target;
  return (
    <span
      className={`reward-badge badge-${xp}`}
      style={{ width: size, height: size }}
    >
      <Icon size={size * 0.42} strokeWidth={1.6} />
    </span>
  );
}
export function Sheet({
  title,
  children,
  onClose,
  onBack,
  full = false,
  active = true,
  closeLabel = "Close",
  backLabel = "Back",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onBack?: () => void;
  full?: boolean;
  active?: boolean;
  closeLabel?: string;
  backLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Capture the opener before a parent sheet becomes inactive. Each sheet
  // remembers its last focused control while a nested screen is open.
  const opener=useRef(document.activeElement instanceof HTMLElement?document.activeElement:null);
  const lastFocus=useRef<HTMLElement|null>(null);
  useEffect(()=>()=>{const target=opener.current;if(target?.isConnected&&target.getClientRects().length&&!target.closest('[hidden],[inert],[role="dialog"]'))target.focus({preventScroll:true});},[]);
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    // The sheet enters with a transform. Default focus scrolling can shift the
    // clipped app shell by that temporary offset and leave its header offscreen.
    const target=lastFocus.current;
    (target&&root?.contains(target)&&target.getClientRects().length&&!target.matches(':disabled')?target:root)?.focus({ preventScroll: true });
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab" && root) {
        const els = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button,input,select,textarea,a[href],summary,[tabindex]',
          ),
        ).filter((el) => {
          if (el.tabIndex < 0 || el.matches(":disabled") || el.closest("[hidden],[inert]") ||
            !el.getClientRects().length || getComputedStyle(el).visibility !== "visible") return false;
          // Closed details can retain layout boxes for their hidden controls.
          // Only their summary participates in the keyboard order.
          for (let parent = el.parentElement; parent && parent !== root; parent = parent.parentElement) {
            if (parent instanceof HTMLDetailsElement && !parent.open &&
              !parent.querySelector(":scope > summary")?.contains(el)) return false;
          }
          return true;
        });
        // WebKit can skip buttons in its native Tab order. A boundary-only trap
        // then misses the last editable field and lets focus leave the dialog.
        e.preventDefault();
        const current = els.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey
          ? (current <= 0 ? els.length - 1 : current - 1)
          : (current + 1) % els.length;
        (els[next] ?? root).focus();
      }
    };
    document.addEventListener("keydown", listener);
    const content = root?.querySelector<HTMLElement>(".sheet-content");
    let focusFrame = 0;
    const revealFocus = () => {
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        const focused = document.activeElement;
        if (!content || !(focused instanceof HTMLElement) || !content.contains(focused)) return;
        const field = focused.getBoundingClientRect(), viewport = content.getBoundingClientRect();
        const top = viewport.top + 8, bottom = viewport.bottom - 8;
        if (field.top < top || field.height > bottom - top) content.scrollTop += field.top - top;
        else if (field.bottom > bottom) content.scrollTop += field.bottom - bottom;
      });
    };
    root?.addEventListener("focusin", revealFocus);
    const resize = new ResizeObserver(revealFocus);
    if (content) resize.observe(content);
    // Conditional steps can remove the focused button (for example, "I'm up").
    // Keep keyboard focus in the active sheet instead of dropping it on the page.
    const observer = new MutationObserver(() => {
      if (document.activeElement === document.body && root?.isConnected) root.focus({ preventScroll: true });
    });
    if (root) observer.observe(root, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(focusFrame);
      resize.disconnect();
      root?.removeEventListener("focusin", revealFocus);
      observer.disconnect();
      document.removeEventListener("keydown", listener);
    };
  }, [title, active]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`sheet ${full ? "full" : ""}`}
        onFocusCapture={event=>{if(event.target instanceof HTMLElement)lastFocus.current=event.target;}}
        onPointerDownCapture={event=>{const target=event.target instanceof Element?event.target.closest<HTMLElement>('button,input,select,textarea,a[href],summary,[tabindex]'):null;if(target&&!target.matches(':disabled'))lastFocus.current=target;}}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber" />
        <header className="sheet-header">
          {onBack ? (
            <IconButton label={backLabel} onClick={onBack}>
              <ArrowLeft size={20} />
            </IconButton>
          ) : (
            <span className="header-spacer" />
          )}
          <h2>{title}</h2>
          <IconButton label={closeLabel} onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        <div className="sheet-content">{children}</div>
      </section>
    </div>
  );
}
export function CheckMark({ tiny = false }: { tiny?: boolean }) {
  return (
    <span className={`check-mark ${tiny ? "tiny" : ""}`}>
      {tiny ? <Sprout size={18} /> : <Check size={19} strokeWidth={2.5} />}
    </span>
  );
}
export function NextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="next-link" onClick={onClick}>
      {children}
      <ArrowRight size={17} />
    </button>
  );
}
export const CompleteIcon = CircleCheck;
