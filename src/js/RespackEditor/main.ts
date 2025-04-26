import App from "./App.svelte";
import { mount } from "svelte";

const app = mount(App, { target: document.body, props: { pack: undefined } });

export default app;

// for the index to mess with stuff if it wants to
(window as any).respackEditor = app;
