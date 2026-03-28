export const BALANCE = {
  // economy
  basePiecePrice: 2,
  rushMultiplier: 2,
  vipMultiplier: 1.5,
  materialCostPerPiece: 0.5,
  dailyLaborCost: 200,
  overtimeMultiplier: 1.5,
  maintenanceCost: 300,

  // quality
  baseDefectRate: 0.05,
  overtimeDefectBonus: 0.15,
  skipQADetectionFailure: 0.4,
  mismatchSpeedPenalty: 0.3,
  mismatchQualityPenalty: 0.2,

  // reputation
  onTimeDeliveryRep: 5,
  lateDeliveryRep: -10,
  defectShippedRep: -15,
  perfectOrderRep: 8,

  // machines
  conditionDegradePerDay: 5,
  breakdownThreshold: 30,
  maintenanceRestoreAmount: 40,

  // artists
  moraleDecayOvertime: 10,
  moraleRecoverPerDay: 3,
  lowMoraleThreshold: 30,

  // progression
  startingMoney: 10000,
  startingReputation: 50,
  mvpDayCount: 5,
} as const
