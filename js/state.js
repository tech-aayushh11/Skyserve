/**
 * SKYSERVE - AI READINESS ROCKET LAUNCH CHECKER
 * CENTRAL STATE STORE & MOCK TELEMETRY ENGINE
 */

const SkyserveState = {
  // Current user & access control
  currentUser: {
    name: "Dr. Elena Cruz",
    callsign: "FLIGHT-DIRECTOR",
    role: "Admin", // "Admin" | "Engineer" | "Viewer"
    avatar: "EC"
  },

  // Audio mute state
  audioEnabled: true,

  // Active mission identifier
  currentMissionId: "JERICHO-1",

  // Missions registry
  missions: [
    {
      id: "JERICHO-1",
      name: "Jericho-1 Orbital Insertion",
      targetApogee: "120 km (Suborbital Space)",
      launchWindow: "2026-09-16 02:45:00 UTC",
      countdownSeconds: 2535, // T-00:42:15
      launchPad: "Pad-03A Coastal Range",
      rocketModel: "SKYSERVE AERO-MK2"
    },
    {
      id: "ASTRAEUS-IV",
      name: "Astraeus-IV High Altitude Test",
      targetApogee: "45 km (Stratosphere)",
      launchWindow: "2026-10-02 11:00:00 UTC",
      countdownSeconds: 86400,
      launchPad: "Pad-01B Desert Proving Grounds",
      rocketModel: "SKYSERVE HYBRID-X1"
    },
    {
      id: "HYPERION-X",
      name: "Hyperion-X Micro-Payload Demo",
      targetApogee: "150 km (LEO Insertion)",
      launchWindow: "2026-11-15 08:30:00 UTC",
      countdownSeconds: 154000,
      launchPad: "Pad-04 Commercial Spaceport",
      rocketModel: "SKYSERVE HEAVY-MK3"
    }
  ],

  // Configurable launch criteria limits
  launchCriteria: {
    maxWindSpeedKmH: 28.0,
    minTempC: 5.0,
    maxTempC: 38.0,
    maxHumidityPct: 85.0,
    minVisibilityKm: 8.0,
    minBatteryVoltage: 14.8,
    minStabilityMarginCalibers: 1.5,
    maxStabilityMarginCalibers: 2.8,
    minSignalRssi: -85, // dBm
    minTelemetryPacketRate: 35.0,
    requireAllCriticalChecklist: true
  },

  // Subsystem health snapshots
  subsystems: {
    weather: { status: "READY", score: 94, label: "FAVORABLE" },
    rocket: { status: "READY", score: 91, label: "PASS" },
    avionics: { status: "WARNING", score: 76, label: "VOLTAGE SAG" },
    telemetry: { status: "WARNING", score: 79, label: "PACKET JITTER" },
    checklist: { status: "WARNING", score: 81, label: "18 / 22 SIGNED" },
    aiRisk: { status: "WARNING", score: 82, level: "MEDIUM RISK" }
  },

  // Comprehensive 22-item pre-launch checklist
  checklist: [
    {
      id: "CHK-01",
      category: "Weather verification",
      title: "Ground surface wind speed < 28 km/h confirmed",
      priority: "Critical",
      completed: true,
      assignee: "A. Patel (Met Lead)",
      timestamp: "T-00:55:10",
      notes: "Current wind vector steady at 14.8 km/h from 042° NE."
    },
    {
      id: "CHK-02",
      category: "Weather verification",
      title: "Upper atmosphere wind shear & lightning radar clear (30km)",
      priority: "Critical",
      completed: true,
      assignee: "A. Patel (Met Lead)",
      timestamp: "T-00:52:00",
      notes: "Doppler radar returns nominal; no electrical storm cell within 45km."
    },
    {
      id: "CHK-03",
      category: "Structural inspection",
      title: "Airframe composite skin & fin fillet inspection",
      priority: "Critical",
      completed: true,
      assignee: "R. Thorne (Structures)",
      timestamp: "T-00:48:30",
      notes: "Visual and ultrasonic crack tests verified 100% integrity."
    },
    {
      id: "CHK-04",
      category: "Structural inspection",
      title: "Nosecone shear pins & rail button torque checked",
      priority: "Important",
      completed: true,
      assignee: "R. Thorne (Structures)",
      timestamp: "T-00:47:15",
      notes: "Torqued to 3.2 Nm per flight spec."
    },
    {
      id: "CHK-05",
      category: "Rocket configuration",
      title: "Motor igniter installation & continuity bridge check",
      priority: "Critical",
      completed: true,
      assignee: "K. Vance (Propulsion)",
      timestamp: "T-00:44:00",
      notes: "Resistance measured 1.8 ohms. Safety pin installed."
    },
    {
      id: "CHK-06",
      category: "Rocket configuration",
      title: "Dual-deploy recovery black powder charge weighing",
      priority: "Critical",
      completed: true,
      assignee: "K. Vance (Propulsion)",
      timestamp: "T-00:43:10",
      notes: "Drogue: 2.1g FFFFg; Main: 3.4g FFFFg confirmed on digital balance."
    },
    {
      id: "CHK-07",
      category: "Stability verification",
      title: "CG / CP caliper calculation with as-built wet mass",
      priority: "Critical",
      completed: true,
      assignee: "M. Zhang (Aerodynamics)",
      timestamp: "T-00:40:20",
      notes: "CG @ 1.48m, CP @ 1.82m. Stability margin = 2.14 calibers."
    },
    {
      id: "CHK-08",
      category: "Stability verification",
      title: "Launch rail launch angle & azimuth aligned to wind vector",
      priority: "Important",
      completed: true,
      assignee: "M. Zhang (Aerodynamics)",
      timestamp: "T-00:39:00",
      notes: "Rail tilt: 86.5° elevation, azimuth 085° off-range."
    },
    {
      id: "CHK-09",
      category: "Avionics verification",
      title: "Primary Flight Computer boot & watchdog timer heartbeat",
      priority: "Critical",
      completed: true,
      assignee: "S. Roy (Avionics Lead)",
      timestamp: "T-00:36:45",
      notes: "Dual Cortex-M7 processors synchronous; 0 task drops."
    },
    {
      id: "CHK-10",
      category: "Avionics verification",
      title: "Secondary backup flight altimeter armed & locked",
      priority: "Important",
      completed: true,
      assignee: "S. Roy (Avionics Lead)",
      timestamp: "T-00:35:10",
      notes: "Stratologger CF pyro continuity beep pattern 4 confirmed."
    },
    {
      id: "CHK-11",
      category: "Sensor verification",
      title: "Dual 9-DOF IMU zero-rate calibration and gyro alignment",
      priority: "Critical",
      completed: true,
      assignee: "T. Chen (Guidance)",
      timestamp: "T-00:33:00",
      notes: "Bias drift < 0.02 deg/sec; accelerometer gravity vector 9.81 m/s²."
    },
    {
      id: "CHK-12",
      category: "Sensor verification",
      title: "Barometric pressure sensor ambient baseline sync",
      priority: "Important",
      completed: true,
      assignee: "T. Chen (Guidance)",
      timestamp: "T-00:31:25",
      notes: "BMP390 reading 1013.75 hPa; sea-level offset calibrated."
    },
    {
      id: "CHK-13",
      category: "Battery verification",
      title: "Avionics 4S LiPo bus voltage & load test validation",
      priority: "Critical",
      completed: false, // Incomplete! Causes HOLD!
      assignee: "S. Roy (Avionics Lead)",
      timestamp: "Pending",
      notes: "ATTENTION: Cell #3 exhibits 3.61V dip under heater draw. Requires bench re-verify."
    },
    {
      id: "CHK-14",
      category: "Battery verification",
      title: "Telemetry & camera payload auxiliary power rail verify",
      priority: "Important",
      completed: true,
      assignee: "S. Roy (Avionics Lead)",
      timestamp: "T-00:29:40",
      notes: "Aux 2S pack at 8.35V; draw 420mA within design budget."
    },
    {
      id: "CHK-15",
      category: "Telemetry verification",
      title: "S-Band Ground station primary link lock & RSSI > -80 dBm",
      priority: "Critical",
      completed: true,
      assignee: "J. Morales (Comm Lead)",
      timestamp: "T-00:26:00",
      notes: "RSSI solid at -68 dBm; packet error rate 0.04%."
    },
    {
      id: "CHK-16",
      category: "Telemetry verification",
      title: "Backup UHF 433MHz packet stream continuity check",
      priority: "Important",
      completed: false, // Incomplete
      assignee: "J. Morales (Comm Lead)",
      timestamp: "Pending",
      notes: "Intermittent packet jitter observed on secondary downlink antenna."
    },
    {
      id: "CHK-17",
      category: "Ground-system verification",
      title: "Launch pad umbilical retract mechanism arming check",
      priority: "Critical",
      completed: true,
      assignee: "D. O'Connor (Ground Ops)",
      timestamp: "T-00:22:15",
      notes: "Pneumatic quick-release tested; solenoid response 42ms."
    },
    {
      id: "CHK-18",
      category: "Ground-system verification",
      title: "Range perimeter optical radar & airspace NOTAM clearance",
      priority: "Critical",
      completed: true,
      assignee: "D. O'Connor (Ground Ops)",
      timestamp: "T-00:20:00",
      notes: "NOTAM Active SFC-FL250; Range safety zone evacuated 1.2km."
    },
    {
      id: "CHK-19",
      category: "Payload verification",
      title: "Multi-spectral research cubesat telemetry lock",
      priority: "Important",
      completed: true,
      assignee: "E. Lin (Payload Scientist)",
      timestamp: "T-00:17:30",
      notes: "Sensor payload calibrated, thermal conditioning nominal."
    },
    {
      id: "CHK-20",
      category: "Payload verification",
      title: "Payload bay ejection microswitch telemetry test",
      priority: "Informational",
      completed: false, // Incomplete (making 18/22 signed)
      assignee: "E. Lin (Payload Scientist)",
      timestamp: "Pending",
      notes: "Release spring mechanism conditioned; awaiting mechanical lock confirmation."
    },
    {
      id: "CHK-21",
      category: "Final team review",
      title: "Propulsion & Aerodynamics Lead Launch Go/No-Go Poll",
      priority: "Critical",
      completed: true,
      assignee: "Mission Directorate",
      timestamp: "T-00:10:00",
      notes: "Propulsion: GO. Aerodynamics: GO. Structures: GO."
    },
    {
      id: "CHK-22",
      category: "Final team review",
      title: "Flight Director & Range Safety final release authorization",
      priority: "Critical",
      completed: false, // Pending battery and UHF resolution
      assignee: "Dr. Elena Cruz (Flight Dir)",
      timestamp: "Pending",
      notes: "Holding for Avionics Cell 3 resolution and final poll."
    }
  ],

  // Live Weather parameters
  weather: {
    temperatureC: 23.4,
    windSpeedKmH: 14.8,
    windGustKmH: 19.2,
    windDirectionDeg: 42,
    windDirectionCardinal: "NE",
    humidityPct: 54,
    pressureHpa: 1013.8,
    visibilityKm: 16.5,
    precipitationMmH: 0.0,
    lightningRiskKm: 48,
    cloudCoverPct: 15,
    dewPointC: 13.6
  },

  // Rocket physical & structural telemetry
  rocket: {
    identification: "SKYSERVE-MK2 JERICHO",
    missionName: "Jericho-1 Orbital Insertion Test",
    configuration: "2-Stage Solid Booster + Liquid Upper Stage",
    totalWetMassKg: 142.6,
    dryMassKg: 88.2,
    propellantMassKg: 54.4,
    centerOfGravityM: 1.48, // from nose tip
    centerOfPressureM: 1.82, // from nose tip
    stabilityMarginCalibers: 2.14,
    overallLengthM: 3.85,
    diameterMm: 156,
    motorChamberPressureBar: 48.5,
    motorTempC: 26.2,
    finFlutterSafetyMargin: 3.4,
    recoveryDrogueStatus: "ARMED",
    recoveryMainStatus: "ARMED",
    structuralIntegrityPct: 100
  },

  // Avionics hardware telemetry
  avionics: {
    flightComputerStatus: "ONLINE",
    flightComputerCpuUsagePct: 18.4,
    flightComputerClockMhz: 480,
    flightComputerTasks: "14/14 Sync",
    
    imu1Status: "ONLINE",
    imu2Status: "ONLINE",
    imuGyroDriftDegSec: 0.018,
    
    gpsStatus: "ONLINE",
    gpsSatellitesLocked: 18,
    gpsHdop: 0.78,
    gpsAltitudeM: 14.2,
    gpsFixType: "3D RTK High-Precision",
    
    tempSensorCabinC: 24.2,
    tempSensorBayC: 22.8,
    tempSensorEngineC: 26.5,
    
    pressureSensorStatus: "ONLINE",
    pressureBaroHpa: 1013.75,
    
    cameraOpticalStatus: "ONLINE",
    cameraFps: 120,
    cameraBitrateMbps: 35.0,
    
    batteryTotalVoltage: 14.72,
    batteryCurrentDrawA: 1.45,
    batteryCell1V: 3.71,
    batteryCell2V: 3.70,
    batteryCell3V: 3.61, // SAG ANOMALY
    batteryCell4V: 3.70,
    batteryState: "WARNING",
    
    storageTotalGb: 128,
    storageFreeGb: 125.4,
    storageWriteSpeedMbS: 240,
    
    canBusStatus: "ONLINE",
    canBusErrors: 0,
    spiBusErrors: 0
  },

  // Ground and air telemetry streams
  telemetry: {
    signalRssi: -68,
    signalSnrDb: 24.5,
    packetRateSec: 48.2,
    expectedPacketRateSec: 50.0,
    packetLossPct: 0.04,
    downlinkBandwidthKbps: 384,
    groundLinkSband: "ONLINE",
    groundLinkUhf: "WARNING",
    dataLoggingState: "DUAL SYNC ACTIVE",
    connectionStatus: "CARRIER LOCKED",
    sensorAvailabilityPct: 99.4,
    events: [
      { time: "T-00:46:12", code: "TLM-801", text: "Primary S-Band high-gain antenna locked on Pad-03 gantry", type: "ready" },
      { time: "T-00:44:05", code: "AVN-402", text: "Cell #3 voltage dip (3.61V) flagged during bus pre-heating test", type: "warning" },
      { time: "T-00:41:20", code: "GPS-104", text: "Dual RTK GPS locked with 18 satellites; HDOP 0.78", type: "ready" },
      { time: "T-00:38:10", code: "SFT-002", text: "Range safety termination transmitter verified on 450 MHz", type: "ready" },
      { time: "T-00:35:45", code: "TLM-308", text: "Secondary UHF channel packet jitter noticed (delta 62ms)", type: "warning" },
      { time: "T-00:30:10", code: "MET-010", text: "Surface wind shear scan nominal; 14.8 km/h 042° NE", type: "ready" }
    ]
  },

  // AI Analysis Engine State
  aiEngine: {
    lastRunTimestamp: "2026-09-16 00:38:40 UTC",
    isAnalyzing: false,
    riskClassification: "MEDIUM RISK",
    recommendation: "HOLD",
    insights: [
      {
        id: "INS-01",
        type: "warning",
        title: "Battery Cell #3 Voltage Sag Detected",
        desc: "Cell 3 is at 3.61V (0.09V below optimal 3.70V). Recommend completing battery load validation before authorizing countdown.",
        confidence: "98.4%",
        category: "Avionics",
        rule: "Rule AVN-04: Battery cell delta > 0.08V triggers HOLD"
      },
      {
        id: "INS-02",
        type: "ready",
        title: "Weather Envelope Favorable for Transonic Flight",
        desc: "Surface wind vector at 14.8 km/h and zero precipitation present no structural or trajectory risk. 99.2% nominal safety margin.",
        confidence: "99.2%",
        category: "Meteorology",
        rule: "Rule MET-01: Wind speed < 28 km/h"
      },
      {
        id: "INS-03",
        type: "warning",
        title: "Telemetry Packet Latency Jitter on Backup UHF",
        desc: "While primary S-Band link is pristine (-68 dBm), backup UHF link exhibits 62ms jitter. Re-calibration recommended.",
        confidence: "92.1%",
        category: "Telemetry",
        rule: "Rule TLM-02: UHF packet loss < 1.0%"
      },
      {
        id: "INS-04",
        type: "info",
        title: "Similar Historical Condition Found (Static Test #3)",
        desc: "Historical records show cell voltage recovered by +0.06V after 5 min bus stabilization in ambient 23°C weather.",
        confidence: "94.5%",
        category: "Historical Pattern",
        rule: "Model ML-HIST-AERO v2.4"
      },
      {
        id: "INS-05",
        type: "critical",
        title: "Pre-Launch Safety Gate: 2 Critical Checklist Items Incomplete",
        desc: "Safety rules enforce that a mission CANNOT proceed to GO while any Critical checklist items remain unchecked.",
        confidence: "100%",
        category: "Safety Rule Interlock",
        rule: "Mandatory Safety Interlock #1"
      }
    ]
  },

  // Historical Launch Records & Past Reports
  history: [
    {
      id: "REP-2026-0914",
      mission: "JERICHO-1 Wet Dress Rehearsal",
      date: "2026-09-14 14:00 UTC",
      readinessScore: 78,
      status: "HOLD",
      author: "Dr. Elena Cruz",
      summary: "Simulated full countdown; umbilical release successful; fuel boil-off rate verified."
    },
    {
      id: "REP-2026-0820",
      mission: "JERICHO-1 Static Motor Fire #2",
      date: "2026-08-20 09:30 UTC",
      readinessScore: 96,
      status: "GO",
      author: "K. Vance",
      summary: "Solid booster delivered 14,800 N thrust peak; chamber pressure held at 49.2 bar nominal."
    },
    {
      id: "REP-2026-0705",
      mission: "ASTRAEUS-III Stratospheric Test",
      date: "2026-07-05 06:15 UTC",
      readinessScore: 94,
      status: "GO",
      author: "Dr. Elena Cruz",
      summary: "Successful apogee at 38.4 km; dual recovery deployed; full airframe retrieved undamaged."
    }
  ],

  // Flight Attitude & Gyro Horizon telemetry
  attitude: {
    pitchDeg: 89.4,
    rollDeg: 0.2,
    yawDeg: 42.0,
    gimbalAngleDeg: 0.12,
    angularVelocityDegS: 0.015,
    horizonStatus: "NOMINAL VERTICAL"
  },

  // Flight Trajectory & Apogee Profile Simulation
  trajectory: {
    targetApogeeKm: 120.0,
    currentAltitudeKm: 0.014,
    projectedApogeeKm: 121.6,
    velocityKmh: 0,
    maxVelocityKmh: 4950,
    downrangeKm: 0,
    projectedDownrangeKm: 82.4,
    maxQAltitudeKm: 11.5,
    stage1SepAltitudeKm: 35.2,
    flightState: "PAD-STANDBY"
  },

  // Multi-Channel Waveform Oscilloscope Data Buffer
  oscilloscope: {
    selectedChannel: "battery", // "battery" | "pressure" | "rf_rssi" | "vibration"
    history: {
      battery: [14.74, 14.73, 14.72, 14.71, 14.72, 14.70, 14.72, 14.71, 14.72],
      pressure: [48.2, 48.4, 48.5, 48.6, 48.5, 48.4, 48.5, 48.7, 48.5],
      rf_rssi: [-67, -68, -68, -69, -68, -67, -68, -68, -68],
      vibration: [0.04, 0.06, 0.05, 0.08, 0.05, 0.04, 0.06, 0.05, 0.05]
    }
  },

  // Simulation & Telemetry Playback Engine State
  simulation: {
    paused: false,
    speed: 1, // 1x, 2x, 5x
    activeScenario: "baseline_hold"
  },

  // Telemetry buffer for CSV export
  telemetryRecordings: [],

  // System audit and sensor logs
  logs: [
    { id: 101, time: "00:41:18", category: "TELEMETRY", level: "INFO", message: "Downlink carrier lock confirmed on Pad-03 tracking pedestal" },
    { id: 102, time: "00:40:55", category: "AVIONICS", level: "WARN", message: "Cell #3 voltage deviation flag raised: 3.61V vs cell #1 3.71V" },
    { id: 103, time: "00:39:12", category: "WEATHER", level: "INFO", message: "Surface anemometer averaged 14.8 km/h over 10 min window" },
    { id: 104, time: "00:38:40", category: "AI-ENGINE", level: "INFO", message: "Hybrid decision pipeline ran complete evaluation; result = HOLD (82%)" },
    { id: 105, time: "00:36:20", category: "SECURITY", level: "INFO", message: "User Dr. Elena Cruz authenticated as Flight Director (Admin)" },
    { id: 106, time: "00:34:02", category: "CHECKLIST", level: "INFO", message: "Item CHK-07 'CG/CP caliper calculation' signed by M. Zhang" },
    { id: 107, time: "00:31:14", category: "ROCKET", level: "INFO", message: "Fin actuator trim angle calibrated to 0.00 deg zero baseline" },
    { id: 108, time: "00:28:40", category: "AVIONICS", level: "INFO", message: "Optical high-speed camera streaming 1080p @ 120fps verified" }
  ]
};

// Expose state globally for browser console access and debugging
window.SkyserveState = SkyserveState;
