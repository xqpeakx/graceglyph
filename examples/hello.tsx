/** @jsxRuntime automatic */
/** @jsxImportSource ../src */

import {
  App,
  Button,
  Column,
  Text,
  Window,
  render,
  useState,
} from "../src/index.js";

function HelloApp() {
  const [clicks, setClicks] = useState(0);

  return (
    <App>
      <Window title="Hello zenterm" width={44} height={10}>
        <Column gap={1}>
          <Text>Hello from zenterm.</Text>
          <Text style={{ dim: true }}>
            Tab moves focus. F12 toggles the inspector.
          </Text>
          <Text>{clicks === 0 ? "No clicks yet." : `Clicked ${clicks} time${clicks === 1 ? "" : "s"}.`}</Text>
          <Button onClick={() => setClicks((value) => value + 1)}>
            Increment
          </Button>
        </Column>
      </Window>
    </App>
  );
}

render(<HelloApp />);
