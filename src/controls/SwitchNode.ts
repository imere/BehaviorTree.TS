import { ControlNode } from "../ControlNode";
import type { Converter, NodeConfig } from "../TreeNode";
import { NodeStatus, PortList, createInputPort, type NodeUserStatus } from "../basic";

const getPortValue: Converter<any> = (value: any, { hints: { remap } }) => {
  return remap ? value : JSON.parse(value);
};

export function createSwitchNode(NUM_CASES: number) {
  return class SwitchNode extends ControlNode {
    static providedPorts() {
      const ports = new PortList<"variable" | `case_${number}`>([createInputPort("variable")]);
      for (let i = 0; i < NUM_CASES; i++) {
        ports.set(...createInputPort(`case_${i + 1}`));
      }
      return ports;
    }

    constructor(name: string, config: NodeConfig) {
      super(name, config);
      this.registrationId = "Switch";
    }

    private runningChild = -1;

    protected override tick(): NodeUserStatus {
      if (this.childrenCount() !== NUM_CASES + 1) {
        throw new Error(
          `Wrong number of children in SwitchNode(${NUM_CASES}); must be (num_cases + default)`
        );
      }

      const variable = this.getInput("variable", getPortValue);
      let matchIndex = NUM_CASES;

      if (variable !== undefined) {
        // check each case until you find a match
        for (let i = 0; i < NUM_CASES; i++) {
          const value = this.getInput(`case_${i + 1}`, getPortValue);
          if (value !== undefined && variable === value) {
            matchIndex = i;
            break;
          }
        }
      }

      // if another one was running earlier, halt it
      if (this.runningChild !== -1 && this.runningChild !== matchIndex) {
        this.haltChild(this.runningChild);
      }

      const selectedChild = this.children[matchIndex];
      const ret = selectedChild.executeTick();
      if (ret === NodeStatus.SKIPPED) {
        this.runningChild = -1;
        return NodeStatus.SKIPPED;
      } else if (ret === NodeStatus.RUNNING) {
        this.runningChild = matchIndex;
      } else {
        this.resetChildren();
        this.runningChild = -1;
      }

      return ret as NodeUserStatus;
    }

    override halt(): void {
      this.runningChild = -1;
      super.halt();
    }
  };
}

export type Switch = InstanceType<ReturnType<typeof createSwitchNode>>;
