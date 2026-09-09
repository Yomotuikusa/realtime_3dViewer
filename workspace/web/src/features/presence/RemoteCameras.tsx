import { useMemo, type ReactElement } from "react";
import { Html } from "@react-three/drei";
import { Quaternion, Vector3 } from "three";
import type { CameraState, PresenceUser } from "@shared/types";
import { usePresenceStore } from "../../store/presence";
import { useSessionStore } from "../../store/session";

function cameraOrientation(camera: CameraState): Quaternion {
  const direction = new Vector3(...camera.target).sub(new Vector3(...camera.position));
  if (direction.lengthSq() === 0) {
    return new Quaternion();
  }
  return new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
}

function RemoteCamera({ user }: { user: PresenceUser }): ReactElement {
  const camera = user.camera!;
  const orientation = useMemo(() => cameraOrientation(camera), [camera]);

  return (
    <group position={camera.position} quaternion={orientation}>
      <mesh>
        <coneGeometry args={[0.12, 0.3, 8]} />
        <meshStandardMaterial color={user.color} />
      </mesh>
      <Html position={[0, 0.28, 0]} center>
        <span style={{ padding: "0.15rem 0.35rem", color: "#101828", background: "#ffffff", border: "1px solid #d0d5dd", borderRadius: "0.25rem", whiteSpace: "nowrap" }}>
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
