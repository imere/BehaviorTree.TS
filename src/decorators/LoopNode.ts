import { DecoratorNode } from "../DecoratorNode.js";
import { NodeConfig, TreeNode } from "../TreeNode.js";
import {
  NodeStatus,
  PortList,
  createBidiPort,
  createInputPort,
  createOutputPort,
  type NodeUserStatus,
} from "../basic.js";

/**
 * Pop one element at a time off the array in the port "queue" and run the child
 * for each of them, until the array is exhausted.
 *
 * The port accepts an array, or a string holding one. The array is read fresh
 * whenever the node re-enters IDLE, so an upstream node that publishes a new
 * list is picked up on the next pass.
 */
export class LoopNode extends DecoratorNode {
  private childRunning = false;

  private queue: unknown[] | undefined;

  private staticQueue: unknown[] | undefined;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "Loop";

    // "value" is an output port; nothing declares where it should go, so
    // default it to a blackboard entry of the same name
    if (!config.output.has("value")) config.output.set("value", "{=}");

    // a literal array (not a {blackboard} pointer) is a fixed queue
    const raw = this.config.input.get("queue");
    if (raw !== undefined && TreeNode.stripBlackboardPointer(raw) === undefined) {
      this.staticQueue = LoopNode.toArray(raw);
    }
  }

  static providedPorts(): PortList {
    return new PortList([
      createBidiPort("queue"),
      createInputPort(
        "if_empty",
        "Status to return if the queue is empty",
        NodeStatus[NodeStatus.SUCCESS]
      ),
      createOutputPort("value"),
    ]);
  }

  private static toArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return [...raw];
    if (typeof raw === "string") {
      const text = raw.trim();
      if (text.startsWith("[")) {
        const parsed: unknown = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
      }
      // a string queue is split on ';' and each part converted to the element
      // type, as upstream's convertFromString<SharedQueue<T>> does
      return text.split(";").map((part) => LoopNode.toElement(part.trim()));
    }
    throw new Error("LoopNode: port [queue] must contain an array");
  }

  private static toElement(part: string): unknown {
    if (part === "true" || part === "false") return part === "true";
    if (part !== "" && !Number.isNaN(Number(part))) return Number(part);
    return part;
  }

  protected override tick(): NodeUserStatus {
    if (this.status === NodeStatus.IDLE) {
      this.childRunning = false;
      this.queue = this.staticQueue ? [...this.staticQueue] : undefined;
    }

    if (!this.childRunning) {
      if (!this.queue) {
        const raw = this.getInput("queue");
        this.queue = LoopNode.toArray(raw);
      }

      if (this.queue.length === 0) {
        const ifEmpty = NodeStatus[
          this.getInput("if_empty") as keyof typeof NodeStatus
        ] as NodeUserStatus;
        this.setStatus(ifEmpty);
        return ifEmpty;
      }

      this.setOutput("value", this.queue.shift());
    }

    const childStatus = this.child!.executeTick();

    switch (childStatus) {
      case NodeStatus.RUNNING:
        this.childRunning = true;
        this.setStatus(NodeStatus.RUNNING);
        return NodeStatus.RUNNING;

      // a failing child aborts the loop, whatever is left in the queue
      case NodeStatus.FAILURE:
        this.resetChild();
        this.setStatus(NodeStatus.FAILURE);
        return NodeStatus.FAILURE;

      default: {
        const remaining = this.queue!.length > 0;
        this.resetChild();
        if (!remaining) {
          // let the next tick fall through to the empty-queue branch, so
          // if_empty is honoured rather than hardcoded to SUCCESS
          this.setStatus(NodeStatus.RUNNING);
          return NodeStatus.RUNNING;
        }
        this.setStatus(NodeStatus.RUNNING);
        return NodeStatus.RUNNING;
      }
    }
  }
}
