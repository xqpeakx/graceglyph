/** @jsx h */

import {
  App,
  Box,
  Button,
  Column,
  List,
  Row,
  Text,
  TextInput,
  Window,
  h,
  useState,
  useTerminalSize,
} from "../src/index.js";
import { runExample } from "./_entry.js";

const ROLES = ["engineer", "designer", "product", "operations"] as const;

export function FormApp() {
  const size = useTerminalSize();
  const stacked = size.width < 58;
  const compact = size.height < 20;
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState(0);
  const [message, setMessage] = useState(
    "Type a name, pick a role, then press Enter.",
  );

  function submit(): void {
    const role = ROLES[selectedRole] ?? "teammate";
    const label = name.trim() || "friend";
    setMessage(`hello ${label} (${role})`);
  }

  return (
    <App>
      <Window title="Signup form" grow={1} padding={compact ? 0 : 1}>
        <Column gap={1} grow={1}>
          {!compact && (
            <Text style={{ dim: true }}>
              A small controlled form: one input, one list, one clear submit path.
            </Text>
          )}

          {stacked ? (
            <Column gap={compact ? 0 : 1}>
              {!compact && <Text>Name</Text>}
              <TextInput
                value={name}
                onChange={setName}
                onSubmit={submit}
                placeholder="your name"
              />
            </Column>
          ) : (
            <Row gap={1} align="center">
              <Box width={10}>
                <Text>Name</Text>
              </Box>
              <TextInput
                value={name}
                onChange={setName}
                onSubmit={submit}
                placeholder="your name"
                grow={1}
              />
            </Row>
          )}

          <Text>Role</Text>
          <List
            items={ROLES}
            selected={selectedRole}
            onChange={setSelectedRole}
            onSelect={submit}
            height={compact ? 3 : 4}
            render={(role) => role}
          />

          {compact ? (
            <Button onClick={submit}>Submit</Button>
          ) : (
            <Row gap={1} align="center">
              <Button onClick={submit}>Submit</Button>
              <Text style={{ dim: true }}>F12: inspector</Text>
            </Row>
          )}

          <Text>{message}</Text>
        </Column>
      </Window>
    </App>
  );
}

runExample(<FormApp />, import.meta.url);
