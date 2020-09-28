import { invertObj } from "ramda";

export const orders = {
  die: 0x0, //
  stop: 0x1, //
  gaurd: 0x2, //
  playerGaurd: 0x3, //
  turretGaurd: 0x4, //
  bunkerGaurd: 0x5, //
  move: 0x6,
  stopReaver: 0x7, //
  attack1: 0x8, //
  attack2: 0x9, //
  attackUnit: 0xa, //
  attackFixedRange: 0xb, //
  attackTile: 0xc, //
  hover: 0xd,
  attackMove: 0xe,
  infestedCommandCenter: 0xf,
  unusedNothing: 0x10,
  unusedPowerup: 0x11,
  towerGaurd: 0x12,
  towerAttack: 0x13,
  vultureMine: 0x14,
  stayInRange: 0x15,
  turretAttack: 0x16,
  nothing: 0x17,
  unused24: 0x18,
  droneStartBuild: 0x19,
  droneBuild: 0x1a,
  castInfestation: 0x1b,
  moveToInfest: 0x1c,
  infestingCommandCenter: 0x1d,
  placeBuilding: 0x1e,
  placeProtossBuilding: 0x1f,
  createProtossBuilding: 0x20,
  constructingBuilding: 0x21,
  repair: 0x22,
  moveToRepair: 0x23,
  placeAddOn: 0x24,
  buildAddOn: 0x25,
  train: 0x26,
  rallyPointUnit: 0x27,
  rallyPointTile: 0x28,
  zergBirth: 0x29,
  zergUnitMorph: 0x2a,
  zergBuildingMorph: 0x2b,
  incompleteBuilding: 0x2c,
  incompleteMorphing: 0x2d,
  buildNydusExit: 0x2e,
  enterNydusCanal: 0x2f,
  incompleteWarping: 0x30,
  follow: 0x31,
  carrier: 0x32,
  reaverCarrierMove: 0x33,
  carrierStop: 0x34,
  carrierAttack: 0x35,
  carrierMoveToAttack: 0x36,
  carrierIgnore2: 0x37,
  carrierFight: 0x38,
  carrierHoldPosition: 0x39,
  reaver: 0x3a,
  reaverAttack: 0x3b,
  reaverMoveToAttack: 0x3c,
  reaverFight: 0x3d,
  reaverHoldPosition: 0x3e,
  trainFighter: 0x3f,
  interceptorAttack: 0x40,
  scarabAttack: 0x41,
  rechargeShieldsUnit: 0x42,
  rechargeShieldsBattery: 0x43,
  shieldBattery: 0x44,
  interceptorReturn: 0x45,
  droneLand: 0x46,
  buildingLand: 0x47,
  buildingLiftOff: 0x48,
  droneLiftOff: 0x49,
  liftingOff: 0x4a,
  researchTech: 0x4b,
  upgrade: 0x4c,
  larva: 0x4d,
  spawningLarva: 0x4e,
  harvest1: 0x4f,
  harvest2: 0x50,
  moveToGas: 0x51,
  waitForGas: 0x52,
  harvestGas: 0x53,
  returnGas: 0x54,
  moveToMinerals: 0x55,
  waitForMinerals: 0x56,
  miningMinerals: 0x57,
  harvest3: 0x58,
  harvest4: 0x59,
  returnMinerals: 0x5a,
  interrupted: 0x5b,
  enterTransport: 0x5c,
  pickupIdle: 0x5d,
  pickupTransport: 0x5e,
  pickupBunker: 0x5f,
  pickup4: 0x60,
  powerupIdle: 0x61,
  sieging: 0x62,
  unsieging: 0x63,
  watchTarget: 0x64,
  initCreepGrowth: 0x65,
  spreadCreep: 0x66,
  stoppingCreepGrowth: 0x67,
  guardianAspect: 0x68,
  archonWarp: 0x69,
  completingArchonSummon: 0x6a,
  holdPosition: 0x6b,
  queenHoldPosition: 0x6c,
  cloak: 0x6d,
  decloak: 0x6e,
  unload: 0x6f,
  moveUnload: 0x70,
  fireYamatoGun: 0x71,
  moveToFireYamatoGun: 0x72,
  castLockdown: 0x73,
  burrowing: 0x74,
  burrowed: 0x75,
  unburrowing: 0x76,
  castDarkSwarm: 0x77,
  castParasite: 0x78,
  castSpawnBroodlings: 0x79,
  castEmpShockwave: 0x7a,
  nukeWait: 0x7b,
  nukeTrain: 0x7c,
  nukeLaunch: 0x7d,
  nukePaint: 0x7e,
  nukeUnit: 0x7f,
  castNuclearStrike: 0x80,
  nukeTrack: 0x81,
  initializeArbiter: 0x82,
  cloakNearbyUnits: 0x83,
  placeSpiderMine: 0x84,
  rightClickAction: 0x85,
  suicideUnit: 0x86,
  suicideTile: 0x87,
  suicideHoldPosition: 0x88,
  castRecall: 0x89,
  teleport: 0x8a,
  castScannerSweep: 0x8b,
  scanner: 0x8c,
  castDefensiveMatrix: 0x8d,
  castPsionicStorm: 0x8e,
  castIrradiate: 0x8f,
  castPlague: 0x90,
  castConsume: 0x91,
  castEnsnare: 0x92,
  castStasisField: 0x93,
  castHallucination: 0x94,
  hallucination2: 0x95,
  resetCollision: 0x96,
  resetHarvestCollision: 0x97,
  patrol: 0x98,
  CTFCOPInit: 0x99,
  CTFCOPStarted: 0x9a,
  CTFCOP2: 0x9b,
  computerAI: 0x9c,
  atkMoveEp: 0x9d,
  harrassMove: 0x9e,
  AIPatrol: 0x9f,
  guardPost: 0xa0,
  rescuePassive: 0xa1,
  neutral: 0xa2,
  computerReturn: 0xa3,
  InitializePsiProvider: 0xa4,
  scarabSelfDestructing: 0xa5,
  critter: 0xa6,
  hiddenGun: 0xa7,
  openDoor: 0xa8,
  closeDoor: 0xa9,
  hideTrap: 0xaa,
  revealTrap: 0xab,
  enableDoodad: 0xac,
  disableDoodad: 0xad,
  warpIn: 0xae,
  medic: 0xaf,
  medicHeal: 0xb0,
  medicHealMove: 0xb1,
  medicHoldPosition: 0xb2,
  medicHealToIdle: 0xb3,
  castRestoration: 0xb4,
  castDisruptionWeb: 0xb5,
  castMindControl: 0xb6,
  darkArchonMeld: 0xb7,
  castFeedback: 0xb8,
  castOpticalFlare: 0xb9,
  castMaelstrom: 0xba,
  junkYardDog: 0xbb,
  fatal: 0xbc,
  none: 0xbd,
};

export const ordersById = invertObj(orders);
