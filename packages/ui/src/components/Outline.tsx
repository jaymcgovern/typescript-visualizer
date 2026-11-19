import type { NodeKind } from "@tsviz/graph";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { KIND_BADGE } from "../graph/declaration.ts";
import { toggle } from "../graph/filters.ts";
import { outlineGroups, shortPath, type OutlineEntry, type OutlineItem } from "../graph/outline.ts";

interface Props {
  entries: OutlineEntry[];
  /** Kinds the filter bar has faded out; their rows are dimmed. */
  fadedKinds: ReadonlySet<NodeKind>;
  /** Selected declarations, whose rows are marked and scrolled into view. */
  selected: ReadonlySet<string>;
  /** Undefined: open unless the canvas is narrower than 720px. */
  open: boolean | undefined;
  onOpenChange: (open: boolean) => void;
  /** Centres and selects a declaration. */
  onGoTo: (id: string) => void;
  /** The row under the pointer, whose card the canvas highlights. */
  onHover: (id: string | undefined) => void;
}

const PLURAL: Record<NodeKind, string> = {
  interface: "Interfaces",
  class: "Classes",
  type: "Types",
  enum: "Enums",
  function: "Functions",
  variable: "Variables",
  namespace: "Namespaces",
  external: "External",
};

/**
 * Every declaration, grouped by kind, for finding a card without knowing
 * where it is. The filter matches names, files and member names, so it also
 * finds declarations by what they contain. Picking one centres and selects
 * its card.
 */
export function Outline({ entries, fadedKinds, selected, open, onOpenChange, onGoTo, onHover }: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<NodeKind>>(() => new Set());
  const groups = useMemo(() => outlineGroups(entries, query), [entries, query]);
  const filtering = query.trim() !== "";
  const matches = groups.reduce((n, g) => n + g.items.length, 0);
  const listId = useId();
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // Keeps the selected card's row in sight, however it was selected.
  const selectedKey = [...selected].join("\n");
  useEffect(() => {
    if (open === false || !selectedKey) return;
    const row = list.current?.querySelector<HTMLElement>('[aria-current="true"]');

    row?.scrollIntoView({ block: "nearest" });
  }, [open, selectedKey]);

  const go = (id: string) => {
    onHover(undefined);
    onGoTo(id);
  };
  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const first = groups[0]?.items[0];

      if (first) go(first.id);
    } else if (e.key === "Escape" && query) {
      // Clears the filter rather than the canvas selection.
      e.stopPropagation();
      setQuery("");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list.current?.querySelector<HTMLElement>(".outline__item")?.focus();
    }
  };
  // Arrow keys move between rows (and group headers), and up from the first returns to the filter.
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [...(list.current?.querySelectorAll<HTMLElement>(".outline__group, .outline__item") ?? [])];
    const at = rows.indexOf(document.activeElement as HTMLElement);

    if (at < 0) return;
    e.preventDefault();
    const next = at + (e.key === "ArrowDown" ? 1 : -1);

    if (next < 0) input.current?.focus();
    else rows[Math.min(next, rows.length - 1)]?.focus();
  };

  const closed = <Closed auto={open === undefined} onOpen={() => onOpenChange(true)} />;

  if (open === false) return closed;

  return (
    <>
      {open === undefined && closed}
      <aside className={`outline${open === undefined ? " outline--auto" : ""}`} aria-label="Declarations">
        <div className="outline__head">
          <input
            ref={input}
            type="search"
            className="outline__filter"
            placeholder="Name, file or member…"
            aria-label="Filter declarations by name, file or member"
            aria-controls={listId}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // New filter text shows every match, whatever was collapsed.
              setCollapsed(new Set());
            }}
            onKeyDown={onInputKey}
          />
          <button
            type="button"
            className="outline__toggle"
            aria-expanded={true}
            aria-label="Hide declarations list"
            title="Hide declarations list"
            onClick={() => onOpenChange(false)}
          >
            <ListIcon />
          </button>
        </div>
        {filtering && (
          <p className="outline__status" role="status">
            {matches === 0 ? "No declarations match." : `${matches} of ${entries.length} match`}
          </p>
        )}
        <div ref={list} id={listId} className="outline__list nowheel" onKeyDown={onListKey}>
          {groups.map((group) => {
            const expanded = !collapsed.has(group.kind);

            return (
              <section key={group.kind} className={`outline__section decl--${group.kind}`}>
                <h3>
                  <button
                    type="button"
                    className="outline__group"
                    aria-expanded={expanded}
                    onClick={() => setCollapsed((c) => toggle(c, group.kind))}
                  >
                    <span className="outline__chevron" aria-hidden="true" />
                    <span className="card__badge">{KIND_BADGE[group.kind]}</span>
                    <span className="outline__group-name">{PLURAL[group.kind]}</span>
                    <span className="outline__count">
                      {filtering ? `${group.items.length}/${group.total}` : group.total}
                    </span>
                  </button>
                </h3>
                {expanded && (
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <Row
                          item={item}
                          current={selected.has(item.id)}
                          faded={fadedKinds.has(item.kind)}
                          onGo={go}
                          onHover={onHover}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </aside>
    </>
  );
}

/** The collapsed list: just the button that opens it. */
function Closed({ auto, onOpen }: { auto: boolean; onOpen: () => void }) {
  return (
    <div className={`outline outline--closed${auto ? " outline--auto" : ""}`}>
      <button
        type="button"
        className="outline__toggle"
        aria-expanded={false}
        aria-label="Show declarations list"
        title="Show declarations list"
        onClick={onOpen}
      >
        <ListIcon />
      </button>
    </div>
  );
}

function Row({
  item,
  current,
  faded,
  onGo,
  onHover,
}: {
  item: OutlineItem;
  current: boolean;
  faded: boolean;
  onGo: (id: string) => void;
  onHover: (id: string | undefined) => void;
}) {
  const member = item.match?.via === "member" ? item.match.member : undefined;

  return (
    <button
      type="button"
      className={`outline__item${faded ? " outline__item--faded" : ""}`}
      aria-current={current}
      title={item.where ? `${item.name} · ${item.where}` : item.name}
      onClick={() => onGo(item.id)}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(undefined)}
      onFocus={() => onHover(item.id)}
      onBlur={() => onHover(undefined)}
    >
      <span className="outline__name">{item.name}</span>
      {member !== undefined && <span className="outline__member">.{member}</span>}
      {item.where && <span className="outline__where">{shortPath(item.where)}</span>}
    </button>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 3.5h12M2 8h12M2 12.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
