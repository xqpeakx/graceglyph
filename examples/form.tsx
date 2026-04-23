/** @jsxRuntime automatic */
/** @jsxImportSource ../src */

import {
  App,
  Box,
  Button,
  Column,
  List,
  Panel,
  Row,
  Text,
  TextInput,
  Window,
  render,
  useState,
} from "../src/index.js";

const ROLES = ["engineer", "designer", "product", "operations"] as const;

function FormApp() {
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState(0);
  const [message, setMessage] = useState(
    "Tab through the form, then press Enter on Submit.",
  );

  function submit(): void {
    const role = ROLES[selectedRole] ?? "teammate";
    const label = name.trim() || "friend";
    setMessage(`hello ${label} (${role})`);
  }

  return (
    <App>
      <Window title="Signup form" width={62} height={19}>
        <Column gap={1} grow={1}>
          <Panel title="Profile" grow={1}>
            <Column gap={1}>
              <Row gap={1} align="center">
                <Box width={10}>
                  <Text>Name</Text>
                </Box>
                <TextInput
                  value={name}
                  onChange={setName}
                  onSubmit={submit}
                  placeholder="your name"
                  width={34}
                />
              </Row>

              <Text style={{ dim: true }}>
                Use arrows in the role list. Enter submits from either control.
              </Text>

              <List
                items={ROLES}
                selected={selectedRole}
                onChange={setSelectedRole}
                onSelect={submit}
                height={4}
                render={(role) => role}
              />
            </Column>
          </Panel>

          <Row gap={1} align="center">
            <Button onClick={submit}>Submit</Button>
            <Text style={{ dim: true }}>F12: inspector</Text>
          </Row>

          <Panel title="Status" height={4}>
            <Text>{message}</Text>
          </Panel>
        </Column>
      </Window>
    </App>
  );
}

render(<FormApp />);
