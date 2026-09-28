import { EventEmitter } from "events";

export type PubSubEvent =
  | { type: "message";          channelId: number; data: unknown }
  | { type: "reaction";         channelId: number; data: unknown }
  | { type: "reaction_removed"; channelId: number; data: unknown };

// Single in-process event bus — all SSE connections subscribe here.
// For multi-process / multi-server deployments this would need a Redis adapter,
// but a single Express process is fine for this club's scale.
class MessagePubSub extends EventEmitter {
  publish(event: PubSubEvent) {
    this.emit(`channel:${event.channelId}`, event);
  }

  subscribeChannels(channelIds: number[], listener: (ev: PubSubEvent) => void) {
    for (const id of channelIds) {
      this.on(`channel:${id}`, listener);
    }
  }

  unsubscribeChannels(channelIds: number[], listener: (ev: PubSubEvent) => void) {
    for (const id of channelIds) {
      this.off(`channel:${id}`, listener);
    }
  }
}

export const pubSub = new MessagePubSub();
pubSub.setMaxListeners(500); // allow many concurrent SSE connections
