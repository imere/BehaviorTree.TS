import { findForbiddenChar, formatForbiddenChar, isReservedAttribute } from "../basic.js";
import { fail, type Positioned } from "./XmlError.js";

/**
 * The name a model is registered under: the ID of a <BehaviorTree> or
 * <SubTree>, and the element name of a custom node type. It becomes part of the
 * saved XML and of a file name, so it may not be empty, may not be the reserved
 * "Root", and may not contain a character that would break either.
 */
export function validateModelName(name: string, at?: Positioned): void {
  if (name === "") {
    fail(at, "Model/Node type name cannot be empty");
  }
  if (name === "Root" || name === "root") {
    fail(at, "'Root' is a reserved name and cannot be used as a node type");
  }
  const c = findForbiddenChar(name);
  if (c !== undefined) {
    fail(at, `Model name '${name}' contains forbidden character ${formatForbiddenChar(c)}`);
  }
}

/**
 * The name of a port. It is an XML attribute name, so besides the forbidden
 * characters it may not be empty, may not start with a digit, and may not
 * collide with one of the attributes the XML layer gives a meaning to.
 */
export function validatePortName(name: string, at?: Positioned): void {
  if (name === "") {
    fail(at, "Port name cannot be empty");
  }
  if (/^\d/.test(name)) {
    fail(at, `Port name '${name}' cannot start with a digit`);
  }
  const c = findForbiddenChar(name);
  if (c !== undefined) {
    fail(at, `Port name '${name}' contains forbidden character ${formatForbiddenChar(c)}`);
  }
  if (isReservedAttribute(name)) {
    fail(at, `Port name '${name}' is a reserved attribute name`);
  }
}

/**
 * The name a node instance was given, i.e. the value of the [name] attribute.
 *
 * An instance name CAN be empty, because it defaults to the model name. It is
 * an XML attribute VALUE, so it can contain spaces, periods and most other
 * characters; only the control characters that XML itself forbids are
 * rejected.
 */
export function validateInstanceName(name: string, at?: Positioned): void {
  if (name === "") return;

  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    // XML allows tab, newline and carriage return
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) {
      fail(at, `Instance name '${name}' contains invalid control character (ASCII ${code})`);
    }
  }
}
