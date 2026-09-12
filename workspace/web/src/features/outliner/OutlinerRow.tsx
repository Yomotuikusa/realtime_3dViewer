import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { OutlinerNode, OutlinerNodeKind } from "./outliner-tree";
import type { OutlinerSelection } from "./selection";
import { expandAriaLabel, KIND_LABELS, nodeLabel, OUTLINER_LOADING } from "./outliner-labels";
import { ChevronIcon, OutlinerKindIcon } from "./outliner-icons";
import { isSelected } from "./selection";

export interface OutlinerRowProps {
  id: string;
  depth: number;
  label: string;
  kind: OutlinerNodeKind | null;
  badge?: string;
  hidden?: boolean;
  loading?: boolean;
  hasChildren: boolean;
  expanded: boolean;
  selected: boolean;
  onToggleExpand(id: string): void;
  onSelect(): void;
  children?: ReactNode;
}

export function OutlinerRow(props: OutlinerRowProps): ReactElement {
  const { id, depth, label, kind, badge, hidden, loading, hasChildren, expanded, selected, onToggleExpand, onSelect, children } = props;
  return (
    <li
      className="outliner__item"
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selected}
      data-depth={depth}
      data-hidden={hidden === true}
      data-loading={loading === true}
    >
      <div className="outliner__row" style={{ "--outliner-depth": depth } as CSSProperties}>
        {hasChildren ? (
          <button
            type="button"
            className="outliner__expand"
            aria-expanded={expanded}
            aria-label={expandAriaLabel(label, expanded)}
            onClick={() => onToggleExpand(id)}
          >
            <ChevronIcon />
          </button>
        ) : (
          <span className="outliner__expand outliner__expand--leaf" aria-hidden="true"></span>
        )}
        <button type="button" className="outliner__select" aria-pressed={selected} disabled={loading === true} onClick={onSelect}>
          {kind !== null && <OutlinerKindIcon kind={kind} />}
          {badge !== undefined && <span className="badge outliner__tag" data-tone="neutral">{badge}</span>}
          <span className="outliner__name" title={label}>{label}</span>
          {kind !== null && <span className="outliner__kind">{KIND_LABELS[kind]}</span>}
          {loading === true && <span className="outliner__kind">{OUTLINER_LOADING}</span>}
        </button>
      </div>
      {hasChildren && expanded && <ul className="outliner__group" role="group">{children}</ul>}
    </li>
  );
}

export interface OutlinerBranchProps {
  versionId: string;
  node: OutlinerNode;
  depth: number;
  expandedIds: readonly string[];
  selected: OutlinerSelection | null;
  onToggleExpand(id: string): void;
  onSelect(selection: OutlinerSelection): void;
}

export function OutlinerBranch(props: OutlinerBranchProps): ReactElement {
  const { versionId, node, depth, expandedIds, selected, onToggleExpand, onSelect } = props;
  return (
    <OutlinerRow
      id={node.id}
      depth={depth}
      label={nodeLabel(node.name)}
      kind={node.kind}
      hasChildren={node.children.length > 0}
      expanded={expandedIds.includes(node.id)}
      selected={isSelected(selected, versionId, node.id)}
      onToggleExpand={onToggleExpand}
      onSelect={() => onSelect({ versionId, objectId: node.id })}
    >
      {node.children.map((child) => (
        <OutlinerBranch
          key={child.id}
          versionId={versionId}
          node={child}
          depth={depth + 1}
          expandedIds={expandedIds}
          selected={selected}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
        />
      ))}
    </OutlinerRow>
  );
}
