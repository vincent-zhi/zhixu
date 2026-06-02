import type { Device, IoTCommand, SafetyDecision } from "./types.js";

export class IoTSafetyPolicy {
  evaluate(command: IoTCommand, device: Device): SafetyDecision {
    if (device.status === "maintenance") {
      return {
        allowed: false,
        requiresHumanGate: false,
        reason: `设备 ${device.name} 处于维护模式，不允许执行命令`,
      };
    }

    if (device.status === "offline") {
      return {
        allowed: false,
        requiresHumanGate: false,
        reason: `设备 ${device.name} 离线，无法执行命令`,
      };
    }

    const actuator = device.actuators.find((a) => a.id === command.actuatorId);
    if (!actuator) {
      return {
        allowed: false,
        requiresHumanGate: false,
        reason: `设备 ${device.name} 上未找到执行器 ${command.actuatorId}`,
      };
    }

    if (!actuator.commands.includes(command.command)) {
      return {
        allowed: false,
        requiresHumanGate: false,
        reason: `执行器 ${actuator.name} 不支持命令 "${command.command}"，可选: ${actuator.commands.join(", ")}`,
      };
    }

    const isDangerous = actuator.dangerousCommands.includes(command.command);
    if (isDangerous) {
      return {
        allowed: true,
        requiresHumanGate: true,
        reason: `命令 "${command.command}" 在执行器 ${actuator.name} 的危险操作列表中，需要人工确认 (安全等级: ${actuator.safetyLevel})`,
      };
    }

    if (actuator.safetyLevel === "L2" || actuator.safetyLevel === "L3") {
      return {
        allowed: true,
        requiresHumanGate: true,
        reason: `执行器 ${actuator.name} 安全等级为 ${actuator.safetyLevel}，需要人工确认`,
      };
    }

    return {
      allowed: true,
      requiresHumanGate: false,
      reason: "命令安全，允许执行",
    };
  }
}

/** Sliding-window rate limiter for IoT commands per device */
export class IoTCommandQueue {
  private readonly timestamps = new Map<string, number[]>();
  private readonly maxPerMinute: number;

  constructor(maxPerMinute = 30) {
    this.maxPerMinute = maxPerMinute;
  }

  canEnqueue(deviceId: string): boolean {
    this.prune(deviceId);
    const ts = this.timestamps.get(deviceId) ?? [];
    return ts.length < this.maxPerMinute;
  }

  enqueue(deviceId: string): void {
    let ts = this.timestamps.get(deviceId);
    if (!ts) {
      ts = [];
      this.timestamps.set(deviceId, ts);
    }
    ts.push(Date.now());
  }

  /** Get count of commands in the current window */
  getCount(deviceId: string): number {
    this.prune(deviceId);
    return (this.timestamps.get(deviceId) ?? []).length;
  }

  private prune(deviceId: string): void {
    const ts = this.timestamps.get(deviceId);
    if (!ts) return;
    const cutoff = Date.now() - 60_000;
    while (ts.length > 0 && ts[0]! < cutoff) {
      ts.shift();
    }
  }
}
