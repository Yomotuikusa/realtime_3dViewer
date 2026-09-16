import {
  Box3,
  Bone,
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";
import { VIEWER_OVERLAY_KEY, isViewerOverlay } from "../viewer/mesh-display";

/** ジョイント可視化グループの userData キー。値は true */
export const JOINT_OVERLAY_KEY = "jointOverlay";
export const JOINT_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.joint);
export const JOINT_LINK_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.jointLink);
/** ジョイント球の半径 = モデルの最大辺長 * この比 */
export const JOINT_RADIUS_RATIO = 0.008;
/** 最大辺長が 0 のときに使う半径 */
export const JOINT_FALLBACK_RADIUS = 0.01;
/** x-ray のときに使う renderOrder */
export const JOINT_XRAY_RENDER_ORDER = 999;

/** 親も対象に含まれるボーンの [親, 子] 対 */
export type JointLink = readonly [parent: Bone, child: Bone];

/** ジョイント可視化グループ。球とリンク線を固定順で持つ。 */
export interface JointOverlay extends Group {
  userData: Group["userData"] & {
    jointOverlay: true;
    viewerOverlay: true;
    joints: Bone[];
    links: JointLink[];
  };
}

/** ジョイント可視化の色。値は 0xrrggbb */
export interface JointColors {
  /** 関節の球 */
  joint: number;
  /** 親子リンクの線 */
  link: number;
}

const inverseRoot = new Matrix4();
const jointMatrix = new Matrix4();
const jointPosition = new Vector3();

type NeedsUpdateObject = { needsUpdate: boolean };

function markNeedsUpdate(object: NeedsUpdateObject): void {
  object.needsUpdate = true;
  if (object.needsUpdate === true) return;

  let prototype: object | null = Object.getPrototypeOf(object);
  while (prototype !== null) {
    const setter = Object.getOwnPropertyDescriptor(prototype, "needsUpdate")?.set;
    if (setter !== undefined) {
      Object.defineProperty(object, "needsUpdate", {
        configurable: true,
        get: () => true,
        set: (value: boolean) => setter.call(object, value),
      });
      return;
    }
    prototype = Object.getPrototypeOf(prototype);
  }
}

/** root 自身と配下の Bone を traverse 順で集める。overlay の枝はたどらない。 */
export function collectJoints(root: Object3D): Bone[] {
  const joints: Bone[] = [];

  function visit(object: Object3D): void {
    if (isViewerOverlay(object)) return;
    if (object instanceof Bone) joints.push(object);
    for (const child of object.children) visit(child);
  }

  visit(root);
  return joints;
}

/** joints の順で、直接の親も joints に含まれるリンクを作る。 */
export function jointLinks(joints: readonly Bone[]): JointLink[] {
  const included = new Set(joints);
  const links: JointLink[] = [];
  for (const child of joints) {
    const parent = child.parent;
    if (parent instanceof Bone && included.has(parent)) links.push([parent, child]);
  }
  return links;
}

/** root の直下にあるジョイント overlay を返す。 */
export function jointOverlayOf(root: Object3D): JointOverlay | null {
  const overlay = root.children.find((child) => child.userData[JOINT_OVERLAY_KEY] === true);
  return (overlay as JointOverlay | undefined) ?? null;
}

/** root 配下全体の大きさからジョイント球の半径を求める。 */
export function jointRadius(root: Object3D, scale = 1): number {
  const bounds = new Box3().setFromObject(root);
  const size = bounds.getSize(jointPosition);
  const maximum = Math.max(size.x, size.y, size.z);
  return maximum > 0 && Number.isFinite(maximum)
    ? maximum * JOINT_RADIUS_RATIO * scale
    : JOINT_FALLBACK_RADIUS * scale;
}

function overlayObjects(overlay: JointOverlay): [InstancedMesh, LineSegments] {
  return [overlay.children[0] as InstancedMesh, overlay.children[1] as LineSegments];
}

function markOverlay(object: Object3D): void {
  object.userData[VIEWER_OVERLAY_KEY] = true;
  object.raycast = () => undefined;
}

/** root 配下のボーンを可視化し、root へ追加する。 */
export function addJointOverlay(root: Object3D, colors: JointColors, radiusScale = 1): JointOverlay | null {
  const existing = jointOverlayOf(root);
  if (existing !== null) return existing;

  const joints = collectJoints(root);
  if (joints.length === 0) return null;
  const links = jointLinks(joints);

  const spheres = new InstancedMesh(
    new SphereGeometry(jointRadius(root, radiusScale), 8, 6),
    new MeshBasicMaterial({ color: colors.joint, depthWrite: false, toneMapped: false }),
    joints.length,
  );
  spheres.instanceMatrix.setUsage(DynamicDrawUsage);
  spheres.frustumCulled = false;

  const lineGeometry = new BufferGeometry();
  const positions = new Float32BufferAttribute(new Float32Array(links.length * 6), 3);
  positions.setUsage(DynamicDrawUsage);
  lineGeometry.setAttribute("position", positions);
  const lines = new LineSegments(
    lineGeometry,
    new LineBasicMaterial({ color: colors.link, depthWrite: false, toneMapped: false }),
  );
  lines.frustumCulled = false;

  const overlay = new Group() as JointOverlay;
  overlay.userData[JOINT_OVERLAY_KEY] = true;
  overlay.userData[VIEWER_OVERLAY_KEY] = true;
  overlay.userData.joints = joints;
  overlay.userData.links = links;
  markOverlay(overlay);
  markOverlay(spheres);
  markOverlay(lines);
  overlay.add(spheres, lines);
  root.add(overlay);
  setJointOverlayXray(overlay, true);
  return overlay;
}

/** ボーンの現在位置を球とリンク線へ反映する。 */
export function updateJointOverlay(overlay: JointOverlay, root: Object3D): void {
  inverseRoot.copy(root.matrixWorld).invert();
  const [spheres, lines] = overlayObjects(overlay);
  for (let index = 0; index < overlay.userData.joints.length; index += 1) {
    const bone = overlay.userData.joints[index]!;
    jointPosition.setFromMatrixPosition(bone.matrixWorld).applyMatrix4(inverseRoot);
    jointMatrix.makeTranslation(jointPosition.x, jointPosition.y, jointPosition.z);
    spheres.setMatrixAt(index, jointMatrix);
  }
  markNeedsUpdate(spheres.instanceMatrix);

  const position = lines.geometry.getAttribute("position");
  for (let link = 0; link < overlay.userData.links.length; link += 1) {
    const [parent, child] = overlay.userData.links[link]!;
    jointPosition.setFromMatrixPosition(parent.matrixWorld).applyMatrix4(inverseRoot);
    position.setXYZ(link * 2, jointPosition.x, jointPosition.y, jointPosition.z);
    jointPosition.setFromMatrixPosition(child.matrixWorld).applyMatrix4(inverseRoot);
    position.setXYZ(link * 2 + 1, jointPosition.x, jointPosition.y, jointPosition.z);
  }
  markNeedsUpdate(position);
}

/** 可視化の depthTest と renderOrder を切り替える。 */
export function setJointOverlayXray(overlay: JointOverlay, xray: boolean): void {
  const [spheres, lines] = overlayObjects(overlay);
  for (const child of [spheres, lines]) {
    const material = child.material as MeshBasicMaterial | LineBasicMaterial;
    material.depthTest = !xray;
    markNeedsUpdate(material);
  }
  const renderOrder = xray ? JOINT_XRAY_RENDER_ORDER : 0;
  overlay.renderOrder = renderOrder;
  spheres.renderOrder = renderOrder;
  lines.renderOrder = renderOrder;
}

/** root から可視化グループを外し、所有する geometry と material を破棄する。 */
export function removeJointOverlay(root: Object3D): void {
  const overlay = jointOverlayOf(root);
  if (overlay === null) return;
  const [spheres, lines] = overlayObjects(overlay);
  root.remove(overlay);
  spheres.geometry.dispose();
  (spheres.material as MeshBasicMaterial).dispose();
  lines.geometry.dispose();
  (lines.material as LineBasicMaterial).dispose();
}
