import { useMemo, useState, type ReactElement } from "react";
import { isObjectVisible, useObjectsStore } from "../../store/objects";
import { versionTag } from "../objects/objects-labels";
import { useModelScenesStore } from "../compare/model-scenes";
import { buildOutlinerTree, toggleId, type OutlinerNode } from "./outliner-tree";
import { OutlinerBranch, OutlinerRow } from "./OutlinerRow";
import {
  OUTLINER_EMPTY,
  OUTLINER_HEADING,
  nodeLabel,
} from "./outliner-labels";
import { isSelected, useSelectionStore } from "./selection";
import "./outliner.css";

export function Outliner(): ReactElement {
  const objects = useObjectsStore((state) => state.objects);
  const hiddenIds = useObjectsStore((state) => state.hiddenIds);
  const scenes = useModelScenesStore((state) => state.scenes);
  const selected = useSelectionStore((state) => state.selected);
  const toggleSelection = useSelectionStore((state) => state.toggleSelection);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const trees = useMemo(() => {
    const next: Record<string, OutlinerNode> = {};
    for (const [versionId, scene] of Object.entries(scenes)) next[versionId] = buildOutlinerTree(scene);
    return next;
  }, [scenes]);

  const toggleExpand = (id: string): void => {
    setExpandedIds((ids) => toggleId(ids, id));
  };

  return (
    <section className="outliner" aria-label={OUTLINER_HEADING}>
      <h2 className="outliner__heading">{OUTLINER_HEADING}</h2>
      {objects.length === 0 ? (
        <p className="outliner__empty">{OUTLINER_EMPTY}</p>
      ) : (
        <ul className="outliner__tree" role="tree" aria-label={OUTLINER_HEADING}>
          {objects.map((version) => {
            const root = trees[version.id] ?? null;
            const rootId = root?.id ?? version.id;
            return (
              <OutlinerRow
                key={version.id}
                id={rootId}
                depth={0}
                label={version.fileName}
                kind={root?.kind ?? null}
                badge={versionTag(version)}
                hidden={!isObjectVisible(hiddenIds, version.id)}
                loading={root === null}
                hasChildren={root !== null && root.children.length > 0}
                expanded={expandedIds.includes(rootId)}
                selected={root !== null && isSelected(selected, version.id, root.id)}
                onToggleExpand={toggleExpand}
                onSelect={() => {
                  if (root !== null) toggleSelection({ versionId: version.id, objectId: root.id });
                }}
              >
                {root?.children.map((child) => (
                  <OutlinerBranch
                    key={child.id}
                    versionId={version.id}
                    node={child}
                    depth={1}
                    expandedIds={expandedIds}
                    selected={selected}
                    onToggleExpand={toggleExpand}
                    onSelect={toggleSelection}
                  />
                ))}
              </OutlinerRow>
            );
          })}
        </ul>
      )}
    </section>
  );
}
