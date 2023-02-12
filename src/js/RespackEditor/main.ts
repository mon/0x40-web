import App from "./App.svelte";

// not strictly required but it makes webpack put it in `dist`
import "../../../respack_edit.html";

const app = new App({ target: document.body });

export default app;

// for the index to mess with stuff if it wants to
(window as any).respackEditor = app;
