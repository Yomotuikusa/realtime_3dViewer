import { useMemo, useState, type CSSProperties, type ReactElement } from "react";
import type { ClientMessage } from "@shared/protocol";
import {
  hiddenObjectPaths,
  isObjectPartVisible,
  isObjectVisible,
  useObjectsStore,
} from "../../store/objects";
import { versionTag } from "../objects/objects-labels";
import { useModelScenesStore } from "../compare/model-scenes";
import { buildOutlinerTree, toggleId, type OutlinerNode } from "./outliner-tree";
import { OutlinerBranch, OutlinerRow } from "./OutlinerRow";
import {
  OUTLINER_EMPTY,
  OUTLINER_HEADING,
  OUTLINER_VISIBILITY_HEADING,
  nodeLabel,
} from "./outliner-labels";
import { EyeIcon } from "./outliner-icons";
import { isSelected, useSelectionStore } from "./selection";
import { selectViewSetting, useViewSettingsStore } from "../../store/view-settings";
import "./outliner.css";

export function Outliner({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement {
  const objects = useObjectsStore((state) => state.objects);
  const hiddenIds = useObjectsStore((state) => state.hiddenIds);
  const hiddenParts = useObjectsStore((state) => state.hiddenParts);
  const setVisible = useObjectsStore((state) => state.setVisible);
  const setPartVisible = useObjectsStore((state) => state.setPartVisible);
  const scenes = useModelScenesStore((state) => state.scenes);
  const selected = useSelectionStore((state) => state.selected);
  const toggleSelection = useSelectionStore((state) => state.toggleSelection);
  const rowHeightRem = useViewSettingsStore(selectViewSetting("outlinerRowHeightRem"));
  const indentPx = useViewSettingsStore(selectViewSetting("outlinerIndentPx"));
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const trees = useMemo(() => {
    const next: Record<string, OutlinerNode> = {};
    for (const [versionId, scene] of Object.entries(scenes)) next[versionId] = buildOutlinerTree(scene);
    return next;
  }, [scenes]);

  const toggleExpand = (id: string): void => {
    setExpandedIds((ids) => toggleId(ids, id));
  };

  const handleVersionToggle = (versionId: string): void => {
    const visible = isObjectVisible(useObjectsStore.getState().hiddenIds, versionId);
    setVisible(versionId, !visible);
    send({ type: "object:visibility", versionId, visible: !visible });
  };

  const handlePartToggle = (versionId: string, objectPath: string): void => {
    const visible = isObjectPartVisible(useObjectsStore.getState().hiddenParts, versionId, objectPath);
    setPartVisible(versionId, objectPath, !visible);
    send({ type: "object:part-visibility", versionId, objectPath, visible: !visible });
  };

  return (
    <section
      className="outliner"
      aria-label={OUTLINER_HEADING}
      style={{ "--outliner-row-height": `${rowHeightRem}rem`, "--outliner-indent": `${indentPx}px` } as CSSProperties}
    >
      <div className="outliner__head">
        <h2 className="outliner__heading">{OUTLINER_HEADING}</h2>
        <span className="outliner__eye" role="img" aria-label={OUTLINER_VISIBILITY_HEADING} title={OUTLINER_VISIBILITY_HEADING}>
          <EyeIcon />
        </span>
      </div>
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
                visible={isObjectVisible(hiddenIds, version.id)}
                ancestorHidden={false}
                loading={root === null}
                hasChildren={root !== null && root.children.length > 0}
                expanded={expandedIds.includes(rootId)}
                selected={root !== null && isSelected(selected, version.id, root.id)}
                onToggleExpand={toggleExpand}
                onSelect={() => {
                  if (root !== null) toggleSelection({ versionId: version.id, objectId: root.id });
                }}
                onToggleVisible={() => handleVersionToggle(version.id)}
              >
                {root?.children.map((child) => (
                  <OutlinerBranch
                    key={child.id}
                    versionId={version.id}
                    node={child}
                    depth={1}
                    expandedIds={expandedIds}
                    selected={selected}
                    hiddenPaths={hiddenObjectPaths(hiddenParts, version.id)}
                    ancestorHidden={!isObjectVisible(hiddenIds, version.id)}
                    onToggleExpand={toggleExpand}
                    onSelect={toggleSelection}
                    onToggleVisible={handlePartToggle}
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
