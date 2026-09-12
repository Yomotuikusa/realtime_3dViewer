import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { OutlinerNode, OutlinerNodeKind } from "./outliner-tree";
import type { OutlinerSelection } from "./selection";
import { expandAriaLabel, KIND_LABELS, nodeLabel, OUTLINER_LOADING, visibilityAriaLabel } from "./outliner-labels";
import { ChevronIcon, OutlinerKindIcon } from "./outliner-icons";
import { isSelected } from "./selection";

export interface OutlinerRowProps {
  id: string;
  depth: number;
  label: string;
  kind: OutlinerNodeKind | null;
  badge?: string;
  loading?: boolean;
  hasChildren: boolean;
  expanded: boolean;
  selected: boolean;
  visible: boolean;
  ancestorHidden: boolean;
  onToggleExpand(id: string): void;
  onSelect(): void;
  onToggleVisible(): void;
  children?: ReactNode;
}

export function OutlinerRow(props: OutlinerRowProps): ReactElement {
  const { id, depth, label, kind, badge, loading, hasChildren, expanded, selected, visible, ancestorHidden, onToggleExpand, onSelect, onToggleVisible, children } = props;
  return (
    <li
      className="outliner__item"
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selected}
      data-depth={depth}
      data-hidden={!visible || ancestorHidden}
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
        <input
          type="checkbox"
          className="outliner__visible"
          checked={visible}
          disabled={loading === true}
          aria-label={visibilityAriaLabel(label)}
          onChange={onToggleVisible}
        />
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
  hiddenPaths: readonly string[];
  ancestorHidden: boolean;
  onToggleExpand(id: string): void;
  onSelect(selection: OutlinerSelection): void;
  onToggleVisible(versionId: string, objectPath: string): void;
}

export function OutlinerBranch(props: OutlinerBranchProps): ReactElement {
  const { versionId, node, depth, expandedIds, selected, hiddenPaths, ancestorHidden, onToggleExpand, onSelect, onToggleVisible } = props;
  const visible = !hiddenPaths.includes(node.path);
  return (
    <OutlinerRow
      id={node.id}
      depth={depth}
      label={nodeLabel(node.name)}
      kind={node.kind}
      visible={visible}
      ancestorHidden={ancestorHidden}
      hasChildren={node.children.length > 0}
      expanded={expandedIds.includes(node.id)}
      selected={isSelected(selected, versionId, node.id)}
      onToggleExpand={onToggleExpand}
      onSelect={() => onSelect({ versionId, objectId: node.id })}
      onToggleVisible={() => onToggleVisible(versionId, node.path)}
    >
      {node.children.map((child) => (
        <OutlinerBranch
          key={child.id}
          versionId={versionId}
          node={child}
          depth={depth + 1}
          expandedIds={expandedIds}
          selected={selected}
          hiddenPaths={hiddenPaths}
          ancestorHidden={ancestorHidden || !visible}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          onToggleVisible={onToggleVisible}
        />
      ))}
    </OutlinerRow>
  );
}
