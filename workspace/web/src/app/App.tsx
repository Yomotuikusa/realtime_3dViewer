import type React from "react";
import { navigate, useRoute, type Route } from "./routes";
import { ReviewPage } from "./ReviewPage";
import { UploadPage } from "./UploadPage";
import { NOT_FOUND_HOME, NOT_FOUND_TITLE } from "./upload-labels";
import { ThemeEffect } from "../features/theme/ThemeEffect";

export function App(): React.ReactElement {
  const route = useRoute();
  return (
    <>
      <ThemeEffect />
      {routeContent(route)}
    </>
  );
}

function routeContent(route: Route): React.ReactElement {
  if (route.name === "upload") {
    return <UploadPage />;
  }
  if (route.name === "review") {
    return <ReviewPage key={route.projectId} projectId={route.projectId} />;
  }
  return (
    <main className="upload upload--message">
      <h1 className="upload__title">{NOT_FOUND_TITLE}</h1>
      <p className="upload__lead">{route.pathname}</p>
      <a className="btn" href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }}>
        {NOT_FOUND_HOME}
      </a>
    </main>
  );
}
