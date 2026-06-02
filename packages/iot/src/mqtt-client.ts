import mqtt from "mqtt";
import { EventEmitter } from "node:events";
import type { TelemetryPayload, IoTCommandAck } from "./types.js";

export interface MQTTClientConfig {
  brokerUrl: string;
  clientId?: string;
  username?: string;
  password?: string;
  reconnectPeriod?: number;
}

export type MQTTMessageHandler = (topic: string, payload: Buffer) => void;

const TOPIC_PREFIX = "zhixu/devices";

export class ZhiXuMQTTClient extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  private readonly config: MQTTClientConfig;
  private readonly handlers = new Map<string, MQTTMessageHandler>();

  constructor(config: MQTTClientConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(this.config.brokerUrl, {
        clientId: this.config.clientId ?? `zhixu-server-${Date.now()}`,
        ...(this.config.username != null ? { username: this.config.username } : {}),
        ...(this.config.password != null ? { password: this.config.password } : {}),
        reconnectPeriod: this.config.reconnectPeriod ?? 5000,
        clean: true,
      });

      this.client.on("connect", () => {
        this.subscribeToTopics();
        this.emit("connected");
        resolve();
      });

      this.client.on("error", (err) => {
        this.emit("error", err);
        reject(err);
      });

      this.client.on("message", (topic, payload) => {
        for (const [pattern, handler] of this.handlers) {
          if (this.topicMatches(pattern, topic)) {
            handler(topic, payload);
          }
        }
      });

      this.client.on("offline", () => {
        this.emit("offline");
      });

      this.client.on("reconnect", () => {
        this.emit("reconnect");
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await new Promise<void>((resolve) => {
        this.client!.end(false, {}, () => resolve());
      });
      this.client = null;
    }
  }

  get connected(): boolean {
    return this.client?.connected ?? false;
  }

  /** Subscribe to all device topics using wildcard */
  private subscribeToTopics(): void {
    if (!this.client) return;
    // telemetry (QoS 0)
    this.client.subscribe(`${TOPIC_PREFIX}/+/telemetry`, { qos: 0 });
    // status (QoS 1)
    this.client.subscribe(`${TOPIC_PREFIX}/+/status`, { qos: 1 });
    // ack (QoS 1)
    this.client.subscribe(`${TOPIC_PREFIX}/+/ack`, { qos: 1 });
    // registration (QoS 1)
    this.client.subscribe(`${TOPIC_PREFIX}/register`, { qos: 1 });
  }

  /** Register a handler for a topic pattern (supports + wildcards) */
  onTopic(pattern: string, handler: MQTTMessageHandler): void {
    this.handlers.set(pattern, handler);
  }

  /** Publish a command to a device (QoS 1) */
  publishCommand(deviceId: string, payload: Record<string, unknown>): void {
    this.publish(`${TOPIC_PREFIX}/${deviceId}/command`, payload, 1);
  }

  /** Publish an emergency stop to a device (QoS 2) */
  publishEmergency(deviceId: string): void {
    this.publish(
      `${TOPIC_PREFIX}/${deviceId}/emergency`,
      { action: "stop_all", timestamp: new Date().toISOString() },
      2,
    );
  }

  /** Publish arbitrary JSON to a topic */
  publish(
    topic: string,
    payload: Record<string, unknown>,
    qos: 0 | 1 | 2 = 0,
  ): void {
    if (!this.client) {
      throw new Error("MQTT client not connected");
    }
    this.client.publish(topic, JSON.stringify(payload), { qos });
  }

  /** Simple glob-style topic match (supports + and #) */
  private topicMatches(pattern: string, topic: string): boolean {
    const patternParts = pattern.split("/");
    const topicParts = topic.split("/");

    for (let i = 0; i < patternParts.length; i++) {
      const p = patternParts[i]!;
      if (p === "#") return true;
      if (i >= topicParts.length) return false;
      if (p !== "+" && p !== topicParts[i]) return false;
    }
    return patternParts.length === topicParts.length;
  }
}

/** Topic helpers */
export const Topics = {
  telemetry: (deviceId: string) => `${TOPIC_PREFIX}/${deviceId}/telemetry`,
  status: (deviceId: string) => `${TOPIC_PREFIX}/${deviceId}/status`,
  command: (deviceId: string) => `${TOPIC_PREFIX}/${deviceId}/command`,
  ack: (deviceId: string) => `${TOPIC_PREFIX}/${deviceId}/ack`,
  emergency: (deviceId: string) => `${TOPIC_PREFIX}/${deviceId}/emergency`,
  register: () => `${TOPIC_PREFIX}/register`,
};
