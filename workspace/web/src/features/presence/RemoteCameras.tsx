import { useMemo, type CSSProperties, type ReactElement } from "react";
import { Html } from "@react-three/drei";
import { Quaternion, Vector3 } from "three";
import type { CameraState, PresenceUser } from "@shared/types";
import { useCameraStore } from "../../store/camera";
import { usePresenceStore } from "../../store/presence";
import { useSessionStore } from "../../store/session";
import { REMOTE_CAMERA_SEGMENTS, remoteCameraSize } from "./remote-camera-size";

function cameraOrientation(camera: CameraState): Quaternion {
  const direction = new Vector3(...camera.target).sub(new Vector3(...camera.position));
  if (direction.lengthSq() === 0) {
    return new Quaternion();
  }
  return new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
}

function RemoteCamera({ user }: { user: PresenceUser }): ReactElement {
  const camera = user.camera!;
  const modelSize = useCameraStore((state) => state.modelSize);
  const { radius, height, tagOffset } = remoteCameraSize(modelSize);
  const orientation = useMemo(() => cameraOrientation(camera), [camera]);

  return (
    <group position={camera.position} quaternion={orientation}>
      <mesh>
        <coneGeometry args={[radius, height, REMOTE_CAMERA_SEGMENTS]} />
        <meshStandardMaterial color={user.color} />
      </mesh>
      <Html position={[0, tagOffset, 0]} center>
        <span className="presence-tag" style={{ "--user-color": user.color } as CSSProperties}>
          {user.name}
        </span>
      </Html>
    </group>
  );
}

export function RemoteCameras(): ReactElement {
  const users = usePresenceStore((state) => state.users);
  const selfId = useSessionStore((state) => state.selfId);
  const remoteUsers = Object.values(users).filter((user) => user.id !== selfId && user.camera !== null);

  return (
    <>
      {remoteUsers.map((user) => <RemoteCamera key={user.id} user={user} />)}
    </>
  );
}
