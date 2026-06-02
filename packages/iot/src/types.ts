import { z } from "zod";

// ========== 设备能力 ==========
export const SensorCapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  range: z.object({ min: z.number(), max: z.number() }),
});

export const ActuatorCapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["relay", "servo", "pwm", "digital"]),
  commands: z.array(z.string()),
  dangerousCommands: z.array(z.string()).default([]),
  safetyLevel: z.enum(["L0", "L1", "L2", "L3"]).default("L1"),
});

// ========== 设备 ==========
export const DeviceStatusSchema = z.enum(["online", "offline", "maintenance", "error"]);

export const DeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  firmwareVersion: z.string().optional(),
  location: z.string().optional(),
  projectId: z.string().optional(),
  sensors: z.array(SensorCapabilitySchema),
  actuators: z.array(ActuatorCapabilitySchema),
  status: DeviceStatusSchema,
  lastSeen: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const RegisterDeviceInputSchema = z.object({
  name: z.string().min(1),
  sensors: z.array(SensorCapabilitySchema),
  actuators: z.array(ActuatorCapabilitySchema),
  location: z.string().optional(),
  projectId: z.string().optional(),
  macAddress: z.string().optional(),
});

// ========== 遥测 ==========
export const TelemetryReadingSchema = z.object({
  sensorId: z.string(),
  value: z.number(),
  unit: z.string(),
  timestamp: z.string().datetime(),
});

export const TelemetryPayloadSchema = z.object({
  deviceId: z.string(),
  readings: z.array(TelemetryReadingSchema),
  rssi: z.number().optional(),
  uptime: z.number().optional(),
});

// ========== 命令 ==========
export const IoTCommandSchema = z.object({
  deviceId: z.string(),
  actuatorId: z.string(),
  command: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string(),
  issuedBy: z.string().default("agent"),
});

export const IoTCommandAckSchema = z.object({
  requestId: z.string(),
  deviceId: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  executedAt: z.string().datetime(),
});

// ========== 告警 ==========
export const IoTAlertTypeSchema = z.enum([
  "threshold_exceeded",
  "device_offline",
  "command_failed",
  "anomaly_detected",
  "emergency_stop",
]);

export const IoTAlertSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  type: IoTAlertTypeSchema,
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
  acknowledged: z.boolean().default(false),
  createdAt: z.string().datetime(),
});

// ========== 阈值规则 ==========
export const ThresholdRuleSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  sensorId: z.string(),
  condition: z.enum(["gt", "lt", "eq", "range_out"]),
  threshold: z.number(),
  thresholdMax: z.number().optional(),
  severity: z.enum(["info", "warning", "critical"]),
  autoAction: z
    .object({ actuatorId: z.string(), command: z.string() })
    .optional(),
});

// ========== 安全评估 ==========
export const SafetyDecisionSchema = z.object({
  allowed: z.boolean(),
  requiresHumanGate: z.boolean(),
  reason: z.string(),
});

// ========== 紧急停止 ==========
export const EmergencyStopResultSchema = z.object({
  deviceId: z.string(),
  actuatorsStopped: z.array(z.string()),
  timestamp: z.string().datetime(),
});

// ========== 类型导出 ==========
export type SensorCapability = z.infer<typeof SensorCapabilitySchema>;
export type ActuatorCapability = z.infer<typeof ActuatorCapabilitySchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;
export type RegisterDeviceInput = z.infer<typeof RegisterDeviceInputSchema>;
export type TelemetryReading = z.infer<typeof TelemetryReadingSchema>;
export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;
export type IoTCommand = z.infer<typeof IoTCommandSchema>;
export type IoTCommandAck = z.infer<typeof IoTCommandAckSchema>;
export type IoTAlert = z.infer<typeof IoTAlertSchema>;
export type IoTAlertType = z.infer<typeof IoTAlertTypeSchema>;
export type ThresholdRule = z.infer<typeof ThresholdRuleSchema>;
export type SafetyDecision = z.infer<typeof SafetyDecisionSchema>;
export type EmergencyStopResult = z.infer<typeof EmergencyStopResultSchema>;
