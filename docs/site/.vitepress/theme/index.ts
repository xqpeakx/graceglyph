import DefaultTheme from "vitepress/theme";
import "@xterm/xterm/css/xterm.css";

import PlaygroundTerminal from "./components/PlaygroundTerminal.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("PlaygroundTerminal", PlaygroundTerminal);
  },
};
