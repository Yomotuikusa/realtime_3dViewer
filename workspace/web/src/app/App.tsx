import type React from "react";
import { useRoute } from "./routes";
import { ReviewPage } from "./ReviewPage";
import { UploadPage } from "./UploadPage";

export function App(): React.ReactElement {
  const route = useRoute();

  if (route.name === "upload") {
    return <UploadPage />;
  }
  if (route.name === "review") {
    return <ReviewPage projectId={route.projectId} />;
  }
  return <main>ページが見つかりません: {route.pathname}</main>;
}
