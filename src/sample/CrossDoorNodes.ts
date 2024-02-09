import { TreeFactory } from "../TreeFactory";
import { NodeStatus, type NodeUserStatus } from "../basic";

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class CrossDoor {
  private doorOpen = false;
  private doorLocked = false;
  private pickAttempts = 0;

  isDoorClosed(): NodeUserStatus {
    return !this.doorOpen ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }

  async passThroughDoor(): Promise<NodeUserStatus> {
    await sleep(500);
    return this.doorOpen ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }

  async openDoor(): Promise<NodeUserStatus> {
    await sleep(500);
    if (this.doorLocked) {
      return NodeStatus.FAILURE;
    } else {
      this.doorOpen = true;
      return NodeStatus.SUCCESS;
    }
  }

  async pickLock(): Promise<NodeUserStatus> {
    await sleep(500);
    if (this.pickAttempts++ > 3) {
      this.doorLocked = false;
      this.doorOpen = true;
    }
    return this.doorOpen ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }

  smashDoor(): NodeUserStatus {
    this.doorLocked = false;
    this.doorOpen = true;
    return NodeStatus.SUCCESS;
  }

  reset() {
    this.doorLocked = false;
    this.doorOpen = true;
    this.pickAttempts = 0;
  }

  registerNodes(factory: TreeFactory) {
    factory.registerSimpleCondition("IsDoorClosed", this.isDoorClosed.bind(this));

    factory.registerSimpleAsyncAction("PassThroughDoor", this.passThroughDoor.bind(this));

    factory.registerSimpleAsyncAction("OpenDoor", this.openDoor.bind(this));

    factory.registerSimpleAsyncAction("PickLock", this.pickLock.bind(this));

    factory.registerSimpleCondition("SmashDoor", this.smashDoor.bind(this));
  }
}
